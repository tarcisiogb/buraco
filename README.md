# Buraco da Família

Buraco Aberto online (4 jogadores, 2 duplas) para jogar em família.

- `index.html` — app (login, cadastro, perfil, aprovação pelo Master)
- `buraco-engine.js` — motor de regras (+ `buraco-engine.test.js`: `node buraco-engine.test.js`)
- `buraco-regras.md` — regras fechadas
- `firestore.rules` — publicadas automaticamente por GitHub Actions (secret `FIREBASE_SERVICE_ACCOUNT`)

## Primeiro acesso (Master)
1. Cadastre-se no app.
2. No console do Firebase → Firestore → `jogadores/<seu uid>`: altere `role` para `master` e `status` para `aprovado`.
