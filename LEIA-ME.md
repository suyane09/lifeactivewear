# Life Activewear — loja + painel /admin

## Estrutura
- `index.html` — loja (lê tudo do Supabase). `assets/img/` — imagens originais.
- `admin/` — painel (`/admin`). `vercel.json` — publicação na Vercel.
- Banco: projeto Supabase **life-activewear** (já configurado: tabelas, RLS, funções, bucket `media`).

## Publicar
Envie a pasta inteira para a Vercel (ou qualquer hospedagem estática). Painel: `https://SEU-SITE/admin`.

## Criar o acesso da proprietária (1x)
1. Supabase → Authentication → Users → **Add user** (e-mail + senha, marque *Auto Confirm*).
2. Supabase → SQL Editor, rode (troque o e-mail):
   `insert into public.admins (user_id,email) select id,email from auth.users where email='EMAIL_DA_DONA';`
3. Authentication → Sign In / Providers → **desative "Allow new users to sign up"**.
4. Authentication → URL Configuration → defina *Site URL* e adicione `https://SEU-SITE/admin` em Redirect URLs (para "Esqueci minha senha").

## Antes de vender
- Estoque inicial está com **10 por variação** (valor provisório): ajuste em Painel → Estoque.
- Categorias Tops/Leggings/Shorts existem sem produtos (não aparecem na home até terem peças).
- Pedidos do site só viram venda e baixam estoque ao marcar **Confirmado**.

## Venda presencial e dashboard
- Painel → **Venda presencial**: escolha cor/tamanho, forma de pagamento (PIX com desconto automático, Cartão, Dinheiro), desconto extra e cliente opcional. A venda é gravada como `entregue` (origem `presencial`) e o estoque baixa na hora, de forma atômica (função `admin_create_sale`); sem estoque, a venda é recusada.
- Cancelar um pedido/venda em **Pedidos** devolve o estoque.
- **Dashboard**: faturamento total/mês/hoje, pedidos pendentes (nº e valor), estoque baixo, gráfico de 30 dias, por pagamento, por origem, por status e mais vendidos (função `admin_dashboard`).
- Banco: migration `presencial_sales_and_dashboard_v2` já aplicada no Supabase (não rode de novo).
