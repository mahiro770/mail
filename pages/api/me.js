import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "NO_SESSION" });
  }

  const { data } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  if (!data) {
    return res.status(401).json({ error: "INVALID_SESSION" });
  }

  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("password_hash")
    .eq("user_email", data.user_email)
    .single();

  return res.status(200).json({
    email: data.user_email,
    firstLogin: !admin?.password_hash,
  });
}