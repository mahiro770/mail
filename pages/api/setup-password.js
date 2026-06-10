import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      error: "パスワードが必要です",
    });
  }

  try {
    // sessionからユーザー特定
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        error: "未ログインです",
      });
    }

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("user_email")
      .eq("token", token)
      .single();

    if (!session) {
      return res.status(401).json({
        error: "セッションが無効です",
      });
    }

    const email = session.user_email;

    // admin取得
    const { data } = await supabaseAdmin
      .from("admins")
      .select("user_email, password_hash, salt")
      .eq("user_email", email)
      .single();

    if (!data) {
      return res.status(404).json({
        error: "ユーザーが見つかりません",
      });
    }

    // 既に設定済み
    if (data.password_hash && data.salt) {
      return res.status(403).json({
        error: "既に設定済みです",
      });
    }

    // 強度チェック
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)
    ) {
      return res.status(400).json({
        error: "パスワード要件を満たしていません",
      });
    }

    // hash生成
    const salt = crypto.randomBytes(16).toString("hex");

    const passwordHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");

    // 保存
    const { error } = await supabaseAdmin
      .from("admins")
      .update({
        password_hash: passwordHash,
        salt,
      })
      .eq("user_email", email);

    if (error) {
      return res.status(500).json({
        error: "保存に失敗しました",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "SERVER_ERROR",
    });
  }
}