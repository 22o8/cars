"""Capture an identified window, never the desktop behind it."""
import ctypes
import win32gui
import win32ui
from PIL import Image, ImageStat

def capture_hwnd(hwnd):
    if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd):
        raise RuntimeError('Target window is not visible')
    left,top,right,bottom=win32gui.GetWindowRect(hwnd)
    width,height=right-left,bottom-top
    if width<=0 or height<=0: raise RuntimeError('Invalid window bounds')
    source=win32gui.GetWindowDC(hwnd)
    src=win32ui.CreateDCFromHandle(source)
    dst=src.CreateCompatibleDC()
    bitmap=win32ui.CreateBitmap()
    try:
        bitmap.CreateCompatibleBitmap(src,width,height)
        dst.SelectObject(bitmap)
        if not ctypes.windll.user32.PrintWindow(hwnd,dst.GetSafeHdc(),2):
            raise RuntimeError('PrintWindow failed; desktop fallback is disabled')
        img=Image.frombuffer('RGB',(width,height),bitmap.GetBitmapBits(True),'raw','BGRX',0,1)
        if max(ImageStat.Stat(img).stddev)<1:
            raise RuntimeError('Window capture is blank')
        return img
    finally:
        dst.DeleteDC();src.DeleteDC()
        win32gui.ReleaseDC(hwnd,source)
        win32gui.DeleteObject(bitmap.GetHandle())
