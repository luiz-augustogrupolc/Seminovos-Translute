# Translute Seminovos — Sistema Web

Sistema completo de gestão de vendas e frota com banco PostgreSQL na nuvem.

---

## 🚀 Deploy no Railway — passo a passo

### 1. Subir o código no GitHub

1. Crie conta em github.com
2. Crie repositório chamado `translute-seminovos`
3. Suba todos os arquivos desta pasta

**Via terminal:**
```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/translute-seminovos.git
git push -u origin main
```

### 2. Criar projeto no Railway

1. Acesse railway.app → entrar com GitHub
2. **New Project → Deploy from GitHub repo**
3. Selecione `translute-seminovos` → **Deploy Now**

### 3. Adicionar PostgreSQL

1. No projeto Railway: **+ New → Database → Add PostgreSQL**
2. O Railway conecta automaticamente via `DATABASE_URL`

### 4. Popular o banco (uma única vez)

Instale o Railway CLI e rode:
```bash
npm install -g @railway/cli
railway login
railway link
railway run node database/seed.js
```

### 5. Gerar domínio público

Railway → Settings → Networking → **Generate Domain**

Pronto! Sistema no ar em algo como:
`https://translute-seminovos.up.railway.app`

---

## 👤 Usuários padrão

| Usuário | Senha | Perfil |
|---------|-------|--------|
| admin | translute2026 | Administrador |
| secretaria | translute123 | Operador |

⚠️ Troque as senhas no primeiro acesso (menu Usuários)

---

## 💰 Custo

Plano **Hobby** do Railway: **$5/mês (≈ R$25)** — mais que suficiente.

---

## Variável de ambiente importante

No Railway → Variables → adicionar:
```
JWT_SECRET = uma-chave-secreta-longa-e-unica-aqui
```

---

## Estrutura

```
translute-seminovos/
├── package.json       → dependências
├── railway.json       → config Railway
├── backend/server.js  → API REST (Express + PostgreSQL)
├── database/seed.js   → popula banco com dados iniciais
└── frontend/index.html → interface completa
```
