import { supabaseAdmin } from "../lib/supabaseAdmin";

export default async function handler(req, res) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "NO_TOKEN" });
    }

    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("user_email")
      .eq("token", token)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    return res.status(200).json({
      email: data.user_email,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}