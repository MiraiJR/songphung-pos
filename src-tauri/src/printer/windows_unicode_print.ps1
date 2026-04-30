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

$fontNormal = New-Object System.Drawing.Font("Courier New", 8.5, [System.Drawing.FontStyle]::Bold)
$fontLarge  = New-Object System.Drawing.Font("Courier New", 11.0, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$sf = New-Object System.Drawing.StringFormat
$sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip

$lineIndex = 0
$lines = $text -split "`r?`n"

$LARGE_MARKER = "@@LARGE@@"
$RECEIPT_CHARS = 32

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)

    $g = $e.Graphics

    if ($script:xOffset -lt 0) {
        $refSize = $g.MeasureString(("M" * $RECEIPT_CHARS), $fontNormal, [int]::MaxValue, $sf)
        $script:xOffset = [Math]::Max(0, ($e.PageBounds.Width - $refSize.Width) / 2)
    }

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
        $g.DrawString($line, $font, $brush, [single]$script:xOffset, [single]$script:currentY, $sf)
        $script:currentY += $lineHeight
        $lineIndex++
    }

    $e.HasMorePages = $false
}

$script:currentY = [single]0
$script:xOffset = [single]-1

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
