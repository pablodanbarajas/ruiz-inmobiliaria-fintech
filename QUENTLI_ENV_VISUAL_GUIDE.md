# Configurar QUENTLI_WEBHOOK_SECRET - Guía Visual

## 🔐 Pasos en Supabase Console

### Paso 1: Ir a Secrets
En el panel de Edge Functions que ves:
1. **Click en "Secrets"** (en el menú izquierdo bajo "MANAGE")
   - Actualmente estás en "Functions" 
   - Necesitas ir a "Secrets"

### Paso 2: Crear Nueva Variable
En la página de Secrets:
1. Click en **"+ New Secret"** (o botón similar)
2. Se abrirá un formulario con dos campos:
   - **Name:** `QUENTLI_WEBHOOK_SECRET`
   - **Value:** [Tu secreto de Quentli]

### Paso 3: Obtener el Valor Secreto

**Opción A: De Quentli (RECOMENDADO)**
- Contacta a Quentli y pide el webhook secret
- Será algo como: `qntl_secret_abc123xyz789...`

**Opción B: Generar uno Seguro**
En PowerShell, ejecuta:
```powershell
# Generar 32 bytes aleatorios en base64
$bytes = New-Object byte[] 32
([System.Security.Cryptography.RNGCryptoServiceProvider]::Create()).GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
Write-Host "Secret generado: $secret"

# Ejemplo de salida:
# Secret generado: kL9mP2qR4sT5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4mN5oP6qR7sT8uV9wX0yZ1aB
```

**Opción C: Para Testing (NO PRODUCCIÓN)**
```
test_quentli_secret_development_only_12345
```

### Paso 4: Completar el Formulario

En Supabase Secrets:
```
┌─────────────────────────────────────────┐
│ New Secret                              │
├─────────────────────────────────────────┤
│ Name:                                   │
│ ┌─────────────────────────────────────┐ │
│ │ QUENTLI_WEBHOOK_SECRET              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Value:                                  │
│ ┌─────────────────────────────────────┐ │
│ │ [tu-secreto-aqui-sin-espacios]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel]  [Save Secret]                │
└─────────────────────────────────────────┘
```

### Paso 5: Guardar

1. Click en **"Save Secret"** o equivalente
2. Verás una confirmación (✅ Secret created successfully)
3. La variable aparecerá en la lista de secrets

### Paso 6: Verificar Deployment

Después de guardar:
1. Vuelve a **"Functions"**
2. Click en **"quentli-webhook"**
3. Deberías ver en los detalles que la función tiene acceso a `QUENTLI_WEBHOOK_SECRET`
4. Redeploy la función (generalmente es automático)

---

## ✅ Verificación

Para confirmar que está configurado correctamente:

### En Supabase SQL Editor:
```sql
-- Test que la función recibe la variable (no mostrará el valor por seguridad)
-- Pero puedes ver que la función existe y está desplegada
SELECT * FROM pg_proc WHERE proname = 'quentli_webhook';

-- Resultado: 1 row (la función está activa)
```

### En la función quentli-webhook (Deno):
La variable estará disponible como:
```typescript
const secret = Deno.env.get('QUENTLI_WEBHOOK_SECRET')
console.log(secret) // Mostrará: [valor-del-secreto]
```

---

## ⚠️ Importante

- ❌ **NO** compartas el valor del secreto por email, Slack, o archivos
- ❌ **NO** lo pushes a Git o repositorio
- ✅ **Está seguro** en Supabase - no es visible después de guardar
- ✅ **Puedes cambiar** el valor en cualquier momento
- ✅ **Los webhooks antiguos** seguirán validando con el nuevo secreto

---

## 🔧 Troubleshooting

### "No veo botón 'New Secret'"
- Verifica estar en la sección **"Secrets"** no en "Functions"
- Scroll down si es necesario

### "ERROR: undefined environment variable 'QUENTLI_WEBHOOK_SECRET'"
- El secreto no está guardado
- Vuelve a Secrets y verifica que aparece en la lista
- Puede tomar 1-2 minutos sincronizarse

### "La función sigue rechazando webhooks con 401"
- Verifica que el secreto es **exacto** (sin espacios, caracteres correctos)
- Pide a Quentli que reenvíe el webhook
- Revisa los logs en **Observability → Logs**

---

## 📋 Checklist Final

- [ ] Abrí Supabase Console → Edge Functions → Secrets
- [ ] Obtuve el secreto de Quentli (o generé uno)
- [ ] Creé nuevo secret con Name: `QUENTLI_WEBHOOK_SECRET`
- [ ] Pegué el valor exacto (sin espacios extra)
- [ ] Hice click en "Save Secret"
- [ ] Veo la variable en la lista de secrets
- [ ] Volví a "Functions" y verifiqué que quentli-webhook está desplegado

---

**Una vez configurado, la validación de webhooks estará activa automáticamente.** ✅

Generado: 2026-06-11
