$bytes = [System.IO.File]::ReadAllBytes("C:\Users\new manju\Downloads\Gusto_Observations_Guide.pdf")
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
# Extract readable text between parenthesis (PDF strings)
$matches = [regex]::Matches($text, '\(([^)]+)\)')
$extracted = foreach ($m in $matches) { $m.Groups[1].Value }
Write-Output ($extracted -join " ")
