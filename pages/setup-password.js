import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function SetupPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // セッション確認（重要）
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok || !data?.email) {
          router.push("/login");
          return;
        }

        // 初回ログインじゃない人も弾く（任意）
        if (!data.firstLogin) {
          router.push("/");
          return;
        }

        setChecking(false);
      } catch {
        router.push("/login");
      }
    };

    checkSession();
  }, []);

  const handleSetupPassword = async () => {
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません");
      return;
    }

    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)
    ) {
      setErrorMessage("パスワード要件を満たしていません");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/setup-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result?.error ?? "エラーが発生しました");
        return;
      }

      router.push("/login?setup=success");
    } catch {
      setErrorMessage("設定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <p>確認中...</p>;

  return (
    <div>
      <h1>初回パスワード設定</h1>

      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        type="password"
        placeholder="パスワード確認"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

      <button
        onClick={handleSetupPassword}
        disabled={loading || !password || !confirmPassword}
      >
        {loading ? "設定中..." : "パスワード設定"}
      </button>
    </div>
  );
}