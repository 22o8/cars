"""Behavioral stage regressions. No real credentials, Windows input, or HTTP."""
import unittest
from unittest.mock import Mock, patch
from contextlib import ExitStack
from pathlib import Path
import agent as a
from navigation import NavigationError, detect_state
from test_navigation import node, snap

class FlowStages(unittest.TestCase):
    def test_01_security_warning_exact_origin(self):
        d=Mock(); d.window_text.return_value='Security Warning'
        with patch.object(a,'_safe_window_texts',return_value=['Security Warning Do you want to run this application https://asy.mof.gov.iq/']):
            self.assertTrue(a._is_trusted_asycuda_security_warning(d))
        with patch.object(a,'_safe_window_texts',return_value=['Security Warning https://asy.mof.gov.iq.evil/']):
            self.assertFalse(a._is_trusted_asycuda_security_warning(d,True))

    def test_02_login_exit_not_blocked_by_empty_security_tuple(self):
        with patch.object(a,'_security_dialog',return_value=(None,None)), patch.object(a,'_native_login_window',return_value=None):
            self.assertTrue(a._wait_native_login_exit(.01))

    def test_03_main_library_is_not_open_document(self):
        self.assertEqual(detect_state(snap(node(1,'internal frame','مكتبة الوثائق'),node(2,'tree','',1)))['state'],'MAIN_SCREEN')

    def test_04_open_page_requires_review(self):
        self.assertEqual(detect_state(snap(node(1,'internal frame','البيان المسبق')))['state'],'PREDECLARATION_OPEN')

    def test_05_review_screenshot_is_uploaded(self):
        response=Mock(ok=True);response.json.return_value={'review':{'id':'r'}}
        with patch.object(a,'take_review_screenshot',return_value=Path('shot.png')) as capture, patch.object(a,'_encode_review_screenshot',return_value=('IMAGE','image/png')), patch.object(a,'cloud_headers',return_value={}),patch.object(a.requests,'post',return_value=response) as post:
            self.assertEqual(a._send_review('job','OTHER_PAGE_OPEN',{}),'r')
            capture.assert_called_once()
            self.assertEqual(post.call_args.kwargs['json']['screenshotBase64'],'IMAGE')

    def test_06_dismiss_refuses_different_target(self):
        self.assertFalse(a._target_matches({'kind':'java_window','windowHwnd':10},{'kind':'java_window','windowHwnd':11}))

    def _navigation_click(self,name):
        item=node(1,'tree item',name,bounds={'x':10,'y':10,'width':60,'height':20})
        current={'state':'MAIN_SCREEN','snapshot':snap(item)}
        ready={'state':'UNIFIED_PROCEDURE_OPEN'}
        with patch.object(a.HELPER,'call',side_effect=[current,ready]),patch.object(a,'_click_live_node',return_value=True) as click,patch.object(a,'_progress'),patch.object(a.time,'sleep'):
            self.assertTrue(a._main_screen_live_click_fallback())
            self.assertEqual(click.call_args.kwargs['clicks'],2)

    def test_07_double_click_folder(self): self._navigation_click('الإجراء الموحد')
    def test_08_double_click_number_page(self): self._navigation_click('رقم الإجراء الموحد')

    def _preflight(self,verified=True):
        stack=ExitStack(); self.addCleanup(stack.close)
        events=[]
        def helper(command,**kw):
            events.append(command)
            if command=='set_company_code':
                events.append('enter')
                return {'enterSent':True,'bounds':{'x':10,'y':10,'width':90,'height':20}}
            return {'state':'UNIFIED_PROCEDURE_OPEN'}
        stack.enter_context(patch.object(a.HELPER,'call',side_effect=helper))
        for name in ('_progress','ensure_unified_procedure_screen','focus_window','log'):
            stack.enter_context(patch.object(a,name))
        stack.enter_context(patch.object(a,'find_asycuda_window',return_value=Mock(_hWnd=1)))
        stack.enter_context(patch('win32gui.GetForegroundWindow',return_value=1))
        for name in ('click','hotkey','write'):
            stack.enter_context(patch.object(a.pyautogui,name))
        enter=stack.enter_context(patch.object(a.pyautogui,'press',side_effect=lambda key:events.append(key)))
        company=stack.enter_context(patch.object(a,'_wait_for_company_data',side_effect=(lambda *args:events.append('verified') or {'verified':True}) if verified else NavigationError('company_data_unverified','not loaded')))
        stack.enter_context(patch.object(a,'take_screenshot',return_value=Path('test.png')))
        submit=stack.enter_context(patch.object(a,'_submit_unified_action'))
        return events,enter,company,submit

    def test_09_company_code_input(self):
        events,*_=self._preflight()
        a.create_unified_procedure({'kind':'test_company','companyCode':'123'})
        self.assertIn('set_company_code',events)

    def test_10_enter_before_verification(self):
        events,*_=self._preflight()
        a.create_unified_procedure({'kind':'test_company','companyCode':'123'})
        self.assertLess(events.index('enter'),events.index('verified'))

    def test_11_company_not_loaded_blocks_create(self):
        *_,submit=self._preflight(False)
        with self.assertRaises(NavigationError): a.create_unified_procedure({'kind':'execute','companyCode':'123'})
        submit.assert_not_called()

    def test_12_preflight_never_creates(self):
        *_,submit=self._preflight()
        result=a.create_unified_procedure({'kind':'test_company','companyCode':'123'})
        self.assertEqual(result['statusCode'],'COMPANY_PREFLIGHT_SUCCESS');submit.assert_not_called()

    def test_13_number_detection_requires_actual_value(self):
        with patch.object(a,'_find_asycuda_modal_window',return_value=None), patch.object(a.HELPER,'call',return_value={'procedureNo':'98765'}),patch.object(a.time,'sleep'):
            self.assertEqual(a._wait_for_creation_result(None)['procedureNo'],'98765')
        with patch.object(a,'_find_asycuda_modal_window',return_value={'hwnd':1}),patch.object(a.HELPER,'call',return_value={'procedureNo':''}),patch.object(a.time,'sleep'):
            self.assertFalse(a._wait_for_creation_result(None)['ready'])

    def test_14_final_screenshot_missing_blocks_upload_completion(self):
        with patch.object(a.requests,'post') as post:
            with self.assertRaises(NavigationError): a.complete_job('job',True,{'screenshotTaken':True,'screenshotName':'nonexistent-regression.png'})
            post.assert_not_called()

    def test_15_waiting_approval_does_not_click(self):
        response=Mock();response.json.return_value={'review':{'id':'r','decision':''}}
        with patch.object(a.requests,'get',return_value=response),patch.object(a,'cloud_headers',return_value={}),patch.object(a,'check_cancelled',side_effect=[None,NavigationError('cancelled_by_user','stop')]),patch.object(a.time,'sleep'),patch.object(a,'_affirm_final_popup_action') as click:
            with self.assertRaises(NavigationError): a._wait_for_completion_decision('job','r')
            click.assert_not_called()

    def test_16_final_confirmation_requires_matching_approval(self):
        response=Mock();response.json.return_value={'review':{'id':'r','decision':'finalize_and_complete'}}
        with patch.object(a.requests,'get',return_value=response),patch.object(a.requests,'post'),patch.object(a,'cloud_headers',return_value={}),patch.object(a,'_progress'),patch.object(a,'_affirm_final_popup_action',return_value={'operation':'confirmed'}) as click:
            self.assertEqual(a._wait_for_completion_decision('job','r'),'finalize_and_complete');click.assert_called_once()

    def test_17_completed_upload_contains_final_image(self):
        with patch.object(a,'SCREENSHOTS',Path(__file__).parent),patch.object(a,'_encode_review_screenshot',return_value=('FINAL','image/png')),patch.object(a,'cloud_headers',return_value={}),patch.object(a.requests,'post') as post:
            a.complete_job('job',True,{'screenshotTaken':True,'screenshotName':Path(__file__).name,'statusCode':'PROCEDURE_COMPLETED','unifiedProcedureNo':'98765'})
            self.assertEqual(post.call_args.kwargs['json']['screenshotBase64'],'FINAL')

if __name__=='__main__': unittest.main()
