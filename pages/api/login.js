import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      error: "メールアドレスとパスワードを入力してください",
    });
  }

  try {
    // ユーザー取得
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("user_email, password_hash, salt")
      .eq("user_email", email.trim())
      .single();

    if (error || !data) {
      return res.status(401).json({
        status: "error",
        error: "管理者ではないか、メールアドレスが間違っています",
      });
    }

    // 初回ログイン判定
    if (!data.password_hash || !data.salt) {
      return res.status(200).json({
        status: "first_login_required",
      });
    }

    // password hash生成
    const inputHash = crypto
      .pbkdf2Sync(password, data.salt, 100000, 64, "sha512")
      .toString("hex");


    let isMatch = false;

    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(inputHash, "hex"),
        Buffer.from(data.password_hash, "hex")
      );
    } catch (e) {
      return res.status(401).json({
        status: "error",
        error: "パスワードが間違っています",
      });
    }

    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        error: "パスワードが間違っています",
      });
    }

    // 既存セッション削除
    const oldToken = req.cookies?.token;

    if (oldToken) {
      await supabaseAdmin.from("sessions").delete().eq("token", oldToken);
    }

    // 新規トークン発行
    const token = crypto.randomUUID();

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        token,
        user_email: data.user_email,
      });

    if (sessionError) {
      return res.status(500).json({
        status: "error",
        error: "セッション作成に失敗しました",
      });
    }

    // cookie設定
    const isProd = process.env.NODE_ENV === "production";

    res.setHeader(
      "Set-Cookie",
      `token=${token}; Path=/; HttpOnly; SameSite=Lax; ${
        isProd ? "Secure;" : ""
      } Max-Age=${60 * 60 * 24 * 7}`
    );

    // 成功
    return res.status(200).json({
      status: "success",
      email: data.user_email,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      status: "error",
      error: "サーバーエラー",
    });
  }
}