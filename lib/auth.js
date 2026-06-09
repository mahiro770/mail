import { supabaseAdmin } from "./supabaseAdmin";
import cookie from "cookie";

export async function auth(req) {
  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies.token;

  if (!token) return null;

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  if (error || !data) return null;

  return data;
}