import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;

  const { data } = await supabaseAdmin
    .from("admins")
    .select("user_email")
    .eq("user_email", email.trim())
    .single();

  if (!data) {
    return res.status(404).json({
      error: "管理者が見つかりません",
    });
  }

  
  const salt = crypto.randomBytes(16).toString("hex");

  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  const { error } = await supabaseAdmin
    .from("admins")
    .update({
      password_hash: passwordHash,
      salt: salt,
    })
    .eq("user_email", email.trim());

  if (error) {
    return res.status(500).json({
      error: "更新に失敗しました",
    });
  }

  return res.status(200).json({
    success: true,
  });
}