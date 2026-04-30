param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Printer
)

$ErrorActionPreference = 'Stop'

$text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8

Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $Printer
$doc.DocumentName = "SongPhung Receipt"

if (-not $doc.PrinterSettings.IsValid) {
    throw "Máy in không hợp lệ: $Printer"
}

$doc.DefaultPageSettings.Landscape = $false
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

# 80mm ≈ 315 hundredths of an inch; height large enough for continuous feed
$paperSize = New-Object System.Drawing.Printing.PaperSize("K80", 315, 1200)
$doc.DefaultPageSettings.PaperSize = $paperSize

# Courier New Bold, sized so 48 monospace chars fit in ~80mm (≈7.5pt)
$font = New-Object System.Drawing.Font("Courier New", 7.5, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$sf = New-Object System.Drawing.StringFormat
$sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip

$lineIndex = 0
$lines = $text -split "`r?`n"

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)

    $g = $e.Graphics
    $lineHeight = [Math]::Ceiling($font.GetHeight($g))
    $y = [single]0

    while ($lineIndex -lt $lines.Length) {
        if ($y + $lineHeight -gt $e.PageBounds.Height) {
            $e.HasMorePages = $true
            return
        }
        $line = $lines[$lineIndex]
        $g.DrawString($line, $font, $brush, [single]0, $y, $sf)
        $y += $lineHeight
        $lineIndex++
    }

    $e.HasMorePages = $false
}

$doc.add_PrintPage($handler)
try {
    $doc.Print()
} finally {
    $doc.remove_PrintPage($handler)
    $doc.Dispose()
    $font.Dispose()
    $sf.Dispose()
}

Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
