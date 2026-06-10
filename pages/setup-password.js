import { useState } from "react";
import { useRouter } from "next/router";

export default function SetupPasswordPage() {
  const router = useRouter();
  const { email } = router.query;
  const safeEmail =
  typeof email === "string" ? email : Array.isArray(email) ? email[0] : "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);


  if (!safeEmail) {
    return <div>メールアドレス取得中...</div>;
  }

  const handleSetupPassword = async () => {
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません");
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
      setErrorMessage(
        "パスワードは8文字以上で、大文字・小文字・数字を含めてください",
      );
      return;
    }

    try {
      setLoading(true);

      
      const response = await fetch("/api/setup-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: safeEmail,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error);
        setLoading(false);
        return;
      }

      alert("パスワードを設定しました");

      router.push("/login");
    } catch (err) {
      setErrorMessage("設定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

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

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      <button
        onClick={handleSetupPassword}
        disabled={loading || !password || !confirmPassword}
      >
        {loading ? "設定中..." : "パスワード設定"}
      </button>
    </div>
  );
}
