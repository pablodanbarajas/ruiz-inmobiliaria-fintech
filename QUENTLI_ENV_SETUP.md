# Configuración de Variables de Entorno en Supabase

## 🔐 QUENTLI_WEBHOOK_SECRET

Esta variable es **CRÍTICA** para la seguridad de los webhooks de pagos.

### ¿Qué es?
- Un string secreto compartido entre Supabase y Quentli
- Se usa para validar la firma HMAC-SHA256 de los webhooks
- Previene ataques de forgery (alguien falsificando pagos)

### 📍 Dónde configurarlo

**Supabase Console → Project Settings → Edge Functions**

### 🔑 Pasos para Configurar

#### Opción A: Supabase Dashboard (Recomendado)

1. Abre **Supabase Console** → Tu proyecto
2. Ve a **Settings** (rueda de engranaje abajo a la izquierda)
3. En el menú izquierdo, ve a **Edge Functions**
4. Busca la sección **Environment Variables**
5. Click en **+ New Variable**
6. Completa:
   - **Name:** `QUENTLI_WEBHOOK_SECRET`
   - **Value:** `[tu-secreto-de-quentli]`
7. Click **Save**

#### Opción B: Via CLI (supabase-cli)

```bash
# Si tienes supabase-cli instalado
supabase secrets set QUENTLI_WEBHOOK_SECRET="[tu-secreto-de-quentli]"
```

### 🔑 Obtener el Secreto

**Tienes 3 opciones:**

#### 1️⃣ Obtener de Quentli (La Correcta)
- Contacta a soporte de Quentli
- Pide el **webhook secret** para validación HMAC
- Te darán un string como: `qntl_secret_abc123xyz...`
- Cópialo exactamente como te lo proporcionen

#### 2️⃣ Generar uno Seguro (Si Quentli no lo proporciona)
```bash
# En PowerShell:
$bytes = [System.Text.Encoding]::UTF8.GetBytes((Get-Random -Count 32 | ForEach-Object {[char]$_}))
$secret = [Convert]::ToBase64String($bytes)
Write-Host $secret

# O usar OpenSSL:
openssl rand -base64 32

# Ejemplo de salida:
# wJ3kL9mP2qR4sT5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4mN5oP6qR7sT8uV9wX0yZ1aB
```

#### 3️⃣ Usar un valor de prueba (SOLO DESARROLLO)
```
test_webhook_secret_12345678901234567890
```

### ✅ Validar Configuración

1. Ve a **Edge Functions** en Supabase Console
2. Abre la función `quentli-webhook`
3. En la sección **Environment Variables**, verifica que `QUENTLI_WEBHOOK_SECRET` aparece en la lista
4. Status debe mostrar ✅ (checkmark verde)

### 🧪 Testing

Para verificar que funciona, ejecuta esta prueba en SQL Editor:

```sql
-- Verificar que la función está disponible
SELECT * FROM pg_proc WHERE proname = 'verify_quentli_signature';

-- Resultado esperado: 1 fila (la función existe)
```

### 📝 Formato del Secreto

| Formato | Ejemplo | Válido |
|---------|---------|--------|
| Base64 | `wJ3kL9mP2qR4sT5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4mN5oP6qR7sT8uV9wX0yZ1aB` | ✅ |
| UUID | `550e8400-e29b-41d4-a716-446655440000` | ✅ |
| Alphanumérida | `qntl_secret_abc123xyz789def456ghi` | ✅ |
| Con espacios | `aB cD eF gH` | ❌ |

### 🔒 Seguridad

- ✅ **No compartas este secreto** con nadie
- ✅ **No lo commits** a Git (está en Supabase, no en código)
- ✅ **Rótalo periódicamente** (cada 3 meses ideal)
- ✅ **Si lo comprometes**, gen genera uno nuevo de inmediato

### ⚠️ Troubleshooting

**Problema:** "ERROR: 42883: function verify_quentli_signature does not exist"
- **Solución:** La función está en el código pero se llama con variables de entorno mal configuradas. Verifica que `QUENTLI_WEBHOOK_SECRET` esté en la lista de Environment Variables.

**Problema:** "Webhooks recibidos pero rechazados con 401"
- **Solución 1:** Verifica que el secreto en Supabase coincide con el que te proporcionó Quentli (sin espacios, caracteres exactos)
- **Solución 2:** Pide a Quentli que reenvíe el webhook (algunos sistemas guardan intentos fallidos)

**Problema:** "¿Por qué no puedo ver la variable después de configurarla?"
- **Nota:** Las variables de entorno NO son visibles nuevamente por seguridad. Solo verás el nombre pero no el valor. Es normal.

### 📋 Checklist Final

- [ ] Obtuve el secreto de Quentli o generé uno seguro
- [ ] Fui a Supabase Console → Settings → Edge Functions
- [ ] Creé variable de entorno `QUENTLI_WEBHOOK_SECRET`
- [ ] El valor está exacto (sin espacios, caracteres correctos)
- [ ] La variable aparece en la lista de Environment Variables
- [ ] La función `quentli-webhook` está desplegada

### 🎯 Próximos Pasos

1. ✅ Configurar `QUENTLI_WEBHOOK_SECRET`
2. ⏳ Testear webhook de Quentli enviando un pago de prueba
3. ⏳ Verificar que la firma se valida correctamente (sin errores 401)
4. ⏳ Implementar retry automático de webhooks rechazados

---

**¿Necesitas ayuda?**
- Supabase Support: https://supabase.com/docs
- Quentli Support: contacta a tu representante

**Última actualización:** 2026-06-11
