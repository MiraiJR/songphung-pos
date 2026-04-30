param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Printer
)

$ErrorActionPreference = 'Stop'

$bytes = [System.IO.File]::ReadAllBytes($Path)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class SongPhungRawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
'@

$h = [IntPtr]::Zero
if (-not [SongPhungRawPrint]::OpenPrinter($Printer, [ref]$h, [IntPtr]::Zero)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "OpenPrinter thất bại (mã $code). Kiểm tra tên máy in trong Danh sách máy in hệ thống."
}

try {
    $doc = New-Object SongPhungRawPrint+DOCINFO
    $doc.pDocName = "SongPhung"
    $doc.pOutputFile = $null
    $doc.pDataType = "RAW"
    if (-not [SongPhungRawPrint]::StartDocPrinter($h, 1, $doc)) {
        $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "StartDocPrinter thất bại (mã $code)"
    }
    try {
        [void][SongPhungRawPrint]::StartPagePrinter($h)
        $written = 0
        $pin = [Runtime.InteropServices.GCHandle]::Alloc($bytes, [Runtime.InteropServices.GCHandleType]::Pinned)
        try {
            $ptr = $pin.AddrOfPinnedObject()
            if (-not [SongPhungRawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$written)) {
                $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                throw "WritePrinter thất bại (mã $code)"
            }
        }
        finally {
            $pin.Free()
        }
        [void][SongPhungRawPrint]::EndPagePrinter($h)
    }
    finally {
        [void][SongPhungRawPrint]::EndDocPrinter($h)
    }
}
finally {
    [void][SongPhungRawPrint]::ClosePrinter($h)
}

Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
