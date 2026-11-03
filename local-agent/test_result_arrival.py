import unittest
from unittest.mock import patch
import agent as a

class ResultArrivalTests(unittest.TestCase):
    def test_completion_dialog_before_barcode_keeps_polling_without_click(self):
        completion={'state':'UNKNOWN_POPUP','target':{'kind':'java_window','name':'انجاز المعاملة','windowHwnd':42}}
        calls=[]
        numbers=iter(['','2600994465'])
        def helper(command,**kw):
            calls.append(command)
            if command=='read_unified_result':return {'procedureNo':next(numbers)}
            if command=='snapshot':return completion
            self.fail('Unexpected action: '+command)
        with patch.object(a.HELPER,'call',side_effect=helper),patch.object(a.time,'sleep'),patch.object(a,'_find_asycuda_modal_window',return_value={'hwnd':42}):
            result=a._wait_for_creation_result(None)
        self.assertTrue(result['ready'])
        self.assertEqual(result['procedureNo'],'2600994465')
        self.assertEqual(result['snapshot']['target']['windowHwnd'],42)
        self.assertEqual(calls.count('read_unified_result'),2)
    def test_unrelated_dialog_is_not_a_completion(self):
        popup={'state':'UNKNOWN_POPUP','target':{'kind':'java_window','name':'Error'}}
        def helper(command,**kw):return {'procedureNo':''} if command=='read_unified_result' else popup
        with patch.object(a.HELPER,'call',side_effect=helper),patch.object(a.time,'sleep'),patch.object(a,'_find_asycuda_modal_window',return_value={'hwnd':42}):
            result=a._wait_for_creation_result(None)
        self.assertFalse(result['ready'])
    def test_completion_dialog_without_number_never_reports_success(self):
        popup={'state':'UNKNOWN_POPUP','target':{'kind':'java_window','name':'انجاز المعاملة'}}
        def helper(command,**kw):return {'procedureNo':''} if command=='read_unified_result' else popup
        with patch.object(a.HELPER,'call',side_effect=helper),patch.object(a.time,'sleep'),patch.object(a.time,'monotonic',side_effect=[0,0,4]):
            result=a._wait_for_creation_result(None,3)
        self.assertFalse(result['ready'])
        self.assertEqual(result['reason'],'number_not_observed_before_deadline')
