import unittest
from unittest.mock import patch, Mock
import agent as a
import win32gui,win32process
class CloseTests(unittest.TestCase):
 def test_already_closed_no_ui_actions(self):
  with patch.object(a,'find_asycuda_window',return_value=None),patch.object(a.HELPER,'close'),patch.object(a.HELPER,'call') as helper:
   self.assertEqual(a.close_asycuda({'id':'test'})['statusCode'],'ASYCUDA_CLOSED')
  helper.assert_not_called()
 def test_wrong_window_identity_never_closes(self):
  with patch.object(a,'find_asycuda_window',return_value=Mock(_hWnd=42)),patch.object(a.HELPER,'call',return_value={'state':'MAIN_SCREEN','snapshot':{'mainHwnd':99}}),patch.object(win32gui,'PostMessage') as post:
   with self.assertRaises(a.NavigationError):a.close_asycuda({'id':'test'})
  post.assert_not_called()
 def test_success_requires_window_disappearance(self):
  snap={'state':'MAIN_SCREEN','snapshot':{'mainHwnd':42,'pid':55}}
  with patch.object(a,'find_asycuda_window',side_effect=[Mock(_hWnd=42),None]),patch.object(a.HELPER,'call',return_value=snap),patch.object(a.HELPER,'close'),patch.object(win32gui,'IsWindow',side_effect=[True,False]),patch.object(win32gui,'GetWindowText',return_value='ASYCUDAWorld production server'),patch.object(win32process,'GetWindowThreadProcessId',return_value=(1,55)),patch.object(win32gui,'PostMessage') as post:
   self.assertEqual(a.close_asycuda({'id':'test'})['statusCode'],'ASYCUDA_CLOSED')
  post.assert_called_once()
 def test_open_form_requires_review_before_window_close(self):
  with patch.object(a,'find_asycuda_window',return_value=Mock(_hWnd=42)),patch.object(a.HELPER,'call',return_value={'state':'UNIFIED_PROCEDURE_OPEN'}),patch.object(a,'_review_metadata',return_value={}),patch.object(a,'_send_review',return_value='review') as review,patch.object(a,'_wait_for_review_decision',return_value='stop'),patch.object(win32gui,'PostMessage') as post:
   with self.assertRaises(a.NavigationError):a.close_asycuda({'id':'test'})
  review.assert_called_once();post.assert_not_called()
