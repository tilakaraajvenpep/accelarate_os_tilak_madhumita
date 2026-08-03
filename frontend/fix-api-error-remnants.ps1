$srcRoot = "c:\Accelarate OS Vikram Sir\AOS_Git\accelarate_os_tilak_madhumita\frontend\src"
$importLine = "import { apiError } from '@/lib/api-error'"

# Pattern matching the leftover fragments (the script left behind part of the function)
$leftoverPattern = @'
 }\s*\})?\?\.response\?\.data\?\.error \?\?[\r\n]+\s+\(err instanceof Error \? err\.message : fallback\)[\r\n]+\s+\)[\r\n]+\}[\r\n]+
'@

$files = Get-ChildItem -Path $srcRoot -Recurse -Include "*.tsx","*.ts" |
  Where-Object { $_.FullName -notlike "*\lib\api-error.ts" }

$changed = 0
foreach ($file in $files) {
  $raw = [System.IO.File]::ReadAllText($file.FullName)
  
  # Use multiline regex to remove the leftover function body fragments
  $newContent = [regex]::Replace($raw, '(?m) \}\s*\}\)?\?\.response\?\.data\?\.error \?\?\r?\n\s+\(err instanceof Error \? err\.message : fallback\)\r?\n\s+\)\r?\n\}\r?\n', "`r`n")
  
  if ($newContent -ne $raw) {
    [System.IO.File]::WriteAllText($file.FullName, $newContent)
    $changed++
    Write-Output "Fixed: $($file.Name)"
  }
}
Write-Output "Total files fixed: $changed"
