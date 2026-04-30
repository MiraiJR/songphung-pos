param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Printer
)

$ErrorActionPreference = 'Stop'

$text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
$text | Out-Printer -Name $Printer

Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
