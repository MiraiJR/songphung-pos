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

$paperSize = New-Object System.Drawing.Printing.PaperSize("K80", 315, 1200)
$doc.DefaultPageSettings.PaperSize = $paperSize

$fontNormal = New-Object System.Drawing.Font("Courier New", 8.0, [System.Drawing.FontStyle]::Bold)
$fontLarge  = New-Object System.Drawing.Font("Courier New", 10.5, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$sf = New-Object System.Drawing.StringFormat
$sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip

$lineIndex = 0
$lines = $text -split "`r?`n"

$LARGE_MARKER = "@@LARGE@@"

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)

    $g = $e.Graphics

    while ($lineIndex -lt $lines.Length) {
        $line = $lines[$lineIndex]

        if ($line.StartsWith($LARGE_MARKER)) {
            $line = $line.Substring($LARGE_MARKER.Length)
            $font = $fontLarge
        } else {
            $font = $fontNormal
        }

        $lineHeight = [Math]::Ceiling($font.GetHeight($g))
        $y_check = if ($lineIndex -eq 0) { 0 } else { $script:currentY }
        if ($y_check + $lineHeight -gt $e.PageBounds.Height) {
            $e.HasMorePages = $true
            return
        }
        $g.DrawString($line, $font, $brush, [single]0, [single]$script:currentY, $sf)
        $script:currentY += $lineHeight
        $lineIndex++
    }

    $e.HasMorePages = $false
}

$script:currentY = [single]0

$doc.add_PrintPage($handler)
try {
    $doc.Print()
} finally {
    $doc.remove_PrintPage($handler)
    $doc.Dispose()
    $fontNormal.Dispose()
    $fontLarge.Dispose()
    $sf.Dispose()
}

Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
