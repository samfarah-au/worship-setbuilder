$key = (Get-Content C:\Claude\Projects\worship-setbuilder\.env | Where-Object { $_ -match "SUPABASE_SERVICE_ROLE_KEY" }).Split('=')[1]
$payload = $key.Split('.')[1]
$padding = 4 - ($payload.Length % 4)
if ($padding -ne 4) { $payload = $payload + ('=' * $padding) }
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
