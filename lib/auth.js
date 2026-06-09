import { supabaseAdmin } from "./supabaseAdmin";

export async function auth(req) {
  const token = req.cookies?.token;

  if (!token) {
    return { error: "NO_TOKEN" };
  }

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  if (error || !data) {
    return { error: "INVALID_SESSION" };
  }

  return {
    email: data.user_email,
  };
}