import unittest
from unified_form import verify_completion_receipt

class CompletionReceiptTests(unittest.TestCase):
    def receipt(self):return {'procedureNo':'2601000497','hwnd':42,'pid':7,'serverSuccess':True,'confirmationClicked':True}
    def test_closed_completed_page_is_valid_with_verified_receipt(self):
        self.assertTrue(verify_completion_receipt(self.receipt(),'2601000497',42,7,True,False))
    def test_missing_receipt_is_not_success(self):
        self.assertFalse(verify_completion_receipt(None,'2601000497',42,7,True,False))
    def test_other_number_window_or_process_are_rejected(self):
        for number,hwnd,pid in [('1',42,7),('2601000497',43,7),('2601000497',42,8)]:
            self.assertFalse(verify_completion_receipt(self.receipt(),number,hwnd,pid,True,False))
    def test_remaining_dialog_is_not_success(self):
        self.assertFalse(verify_completion_receipt(self.receipt(),'2601000497',42,7,False,True))
    def test_unconfirmed_success_is_rejected(self):
        r=self.receipt();r['confirmationClicked']=False
        self.assertFalse(verify_completion_receipt(r,'2601000497',42,7,True,False))

class RecoveryOutboxTests(unittest.TestCase):
    def test_old_server_does_not_discard_recovery(self):
        import agent as a,json,tempfile
        from pathlib import Path
        from unittest.mock import patch,Mock
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);path=base/'pending-completion-recovery.json'
            path.write_text(json.dumps({'id':'job','unifiedProcedureNo':'123'}))
            response=Mock();response.json.return_value={'job':{'status':'failed'}}
            with patch.object(a,'BASE',base),patch.object(a,'cloud_headers',return_value={}),patch.object(a.requests,'post',return_value=response):a.flush_verified_completion_recovery()
            self.assertTrue(path.exists())
    def test_confirmed_recovery_is_archived(self):
        import agent as a,json,tempfile
        from pathlib import Path
        from unittest.mock import patch,Mock
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);(base/'diagnostics').mkdir();path=base/'pending-completion-recovery.json'
            path.write_text(json.dumps({'id':'job','unifiedProcedureNo':'123'}))
            response=Mock();response.json.return_value={'job':{'status':'done','unifiedProcedureNo':'123'}}
            with patch.object(a,'BASE',base),patch.object(a,'cloud_headers',return_value={}),patch.object(a.requests,'post',return_value=response):a.flush_verified_completion_recovery()
            self.assertFalse(path.exists());self.assertTrue((base/'diagnostics/completed-recovery.json').exists())
