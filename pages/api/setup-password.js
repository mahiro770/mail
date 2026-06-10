import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "メールアドレスとパスワードを入力してください",
    });
  }

  try {
    // 管理者存在確認
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("user_email, password_hash, salt")
      .eq("user_email", email.trim())
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: "管理者が見つかりません",
      });
    }

    // パスワード強度チェック
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
      return res.status(400).json({
        error: "パスワード要件を満たしていません",
      });
    }

    if (data.password_hash || data.salt) {
  return res.status(403).json({
    error: "既にパスワード設定済みです",
  });
}

    // salt生成
    const salt = crypto.randomBytes(16).toString("hex");

    // ハッシュ生成
    const passwordHash = crypto
      .pbkdf2Sync(
        password,
        salt,
        100000,
        64,
        "sha512"
      )
      .toString("hex");

    // 保存
    const { error: updateError } = await supabaseAdmin
      .from("admins")
      .update({
        password_hash: passwordHash,
        salt,
      })
      .eq("user_email", email.trim());

    if (updateError) {
      return res.status(500).json({
        error: "パスワード保存失敗",
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