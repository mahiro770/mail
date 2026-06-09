import { supabase } from './supabase';

// ログイン
export async function login(email) {
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("user_email", email)
    .single();

     console.log("data:", data);
     console.log("error:", error);


  if (error || !data) {
    throw new Error("あなたは管理者ではありません");
  }

  // ログイン状態を保存
  localStorage.setItem(
    "loginUser",
    JSON.stringify({
      email,
      isLogin: true,
    }),
  );

  return data;
}

// ログアウト
export function logout() {
  localStorage.removeItem("loginUser");
}

// ログイン状態確認
export function getCurrentUser() {
  try {
    const user = JSON.parse(
      localStorage.getItem("loginUser"),
    );

    if (user?.isLogin) {
      return user;
    }

    return null;
  } catch {
    return null;
  }
}
