param([string]$ProjectRef="")
$ErrorActionPreference="Stop"
if($ProjectRef){supabase link --project-ref $ProjectRef}
supabase functions deploy mobile-payment --no-verify-jwt
supabase functions deploy mobile-payment-webhook --no-verify-jwt
Write-Host "Puis: supabase secrets set PAYMENT_MODE=mock" -ForegroundColor Yellow
