import unittest
from unittest.mock import patch
from navigation import detect_state
from test_navigation import node,snap
import agent

class ObservedClientTests(unittest.TestCase):
 def painted(self,x=20):
  return snap(node(0,'frame',windowHwnd=10,bounds={'x':0,'y':0,'width':1920,'height':1080}),node(1,'internal frame','رقم الاجراء الموحد - جديد [n/a]',0,windowHwnd=10,bounds={'x':x,'y':100,'width':870,'height':640},description='تسجيل. رقم: n/a اسم الشركة: Example'),node(2,'push button','',1,description='التحقق من الوثيقة'))
 def test_painted_document_identified_without_guessing_text_controls(self):
  self.assertEqual(detect_state(self.painted())['state'],'UNIFIED_PROCEDURE_OPEN')
 def test_offscreen_document_is_not_ready(self):
  self.assertEqual(detect_state(self.painted(-1300))['state'],'UNIFIED_PROCEDURE_OFFSCREEN')
 def test_unverified_login_never_retypes_credentials_by_mouse(self):
  with patch.object(agent.pyautogui,'write') as write:
   self.assertFalse(agent._force_fill_login_fields({'usernameBounds':{'x':1}},'fake','fake'))
   write.assert_not_called()
 def test_verified_login_does_not_retype(self):
  with patch.object(agent.pyautogui,'write') as write:
   self.assertTrue(agent._force_fill_login_fields({'fieldsVerified':True},'fake','fake'))
   write.assert_not_called()
 def test_disabled_login_fields_are_loading(self):
  self.assertEqual(detect_state(snap(node(1,'password text',states=['showing','editable'])))['state'],'LOADING')
 def test_empty_security_detection_is_fast_and_native(self):
  with patch('win32gui.EnumWindows'),patch.object(agent,'Desktop') as desktop:
   self.assertEqual(agent._security_dialog(),(None,None))
   desktop.assert_not_called()

if __name__=='__main__':unittest.main()
