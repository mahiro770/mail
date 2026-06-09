import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "メールアドレスを入力してください" });
  }

  try {
    // 管理者チェック
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("id, user_email")
      .eq("user_email", email.trim())
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "管理者ではありません" });
    }

    // 既存トークン取得（Next.js標準）
    const oldToken = req.cookies?.token;

    if (oldToken) {
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("token", oldToken);
    }

    // 新規トークン発行
    const token = crypto.randomUUID();

    // セッション保存
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        token,
        user_email: data.user_email,
      });

    if (sessionError) {
      return res.status(500).json({ error: "セッション作成に失敗しました" });
    }

    // cookie設定（Next.js標準）
    const isProd = process.env.NODE_ENV === "production";

    res.setHeader(
      "Set-Cookie",
      `token=${token}; Path=/; HttpOnly; SameSite=Lax; ${
        isProd ? "Secure;" : ""
      } Max-Age=${60 * 60 * 24 * 7}`
    );

    return res.status(200).json({
      success: true,
      email: data.user_email,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      error: "サーバーエラー",
    });
  }
}