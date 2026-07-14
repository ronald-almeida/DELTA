// /api/check-status.js
// Usado pelo checkout para fazer polling e descobrir quando o Pix foi pago.
// Consulta GET /v1/transactions/{id} - rota confirmada na doc da PayShark.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Parâmetro "id" é obrigatório.' });
  }

  const secretKey = process.env.PAYSHARK_SECRET_KEY;
  if (!secretKey) {
    console.error('PAYSHARK_SECRET_KEY não configurada.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

  try {
    const psResponse = await fetch(`https://api.paysharkgateway.com.br/v1/transactions/${id}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: authHeader,
      },
    });

    const data = await psResponse.json();

    if (!psResponse.ok) {
      console.error('Erro ao consultar status na PayShark:', data);
      return res.status(psResponse.status).json({
        error: data?.message || 'Erro ao consultar status da transação.',
      });
    }

    // Valores documentados pela PayShark: pending, paid, refunded, refused
    const statusBruto = (data?.status || '').toLowerCase();
    const pago = statusBruto === 'paid';

    return res.status(200).json({
      id: data.id,
      statusBruto: data.status,
      status: pago ? 'paid' : statusBruto, // 'paid' | 'pending' | 'refunded' | 'refused'
    });
  } catch (err) {
    console.error('Erro inesperado em /api/check-status:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar status.' });
  }
}
