$srcRoot = "c:\Accelarate OS Vikram Sir\AOS_Git\accelarate_os_tilak_madhumita\frontend\src"
$importLine = "import { apiError } from '@/lib/api-error'"

# The 3-line local definition to remove
$oldFn3 = "function apiError(err: unknown, fallback: string) {`r`n  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error`r`n    ?? (err instanceof Error ? err.message : fallback)`r`n}`r`n"

$files = Get-ChildItem -Path $srcRoot -Recurse -Include "*.tsx","*.ts" |
  Where-Object { $_.FullName -notlike "*\lib\api-error.ts" }

$changed = 0
foreach ($file in $files) {
  $raw = [System.IO.File]::ReadAllText($file.FullName)
  if ($raw -notmatch "function apiError\(err: unknown, fallback: string\)") { continue }

  # Remove the local definition
  $newContent = $raw -replace [regex]::Escape($oldFn3), ""

  # Also remove the trailing blank line that may remain
  $newContent = $newContent -replace "function apiError\(err: unknown, fallback: string\) \{[^\}]+\}\r?\n?", ""

  # Add import line after existing imports if not already there
  if ($newContent -notmatch [regex]::Escape($importLine)) {
    # Find the last import line and insert after it
    $newContent = $newContent -replace "((?:^import [^\n]+\n)+)", "`$1$importLine`n"
  }

  [System.IO.File]::WriteAllText($file.FullName, $newContent)
  $changed++
  Write-Output "Updated: $($file.Name)"
}
Write-Output "Total files updated: $changed"
