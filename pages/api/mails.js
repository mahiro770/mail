import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // --- 削除処理 (DELETE) を追加 ---
  if (req.method === 'DELETE') {
    const { id } = req.query; // クエリパラメータからIDを取得

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Deleted successfully' });
  }

  // GETリクエスト（既存の処理）
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects') 
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ data: null, error: error.message });
    }
    return res.status(200).json({ data, error: null });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}