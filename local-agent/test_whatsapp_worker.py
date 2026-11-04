import unittest
from unittest.mock import patch, Mock
import agent as a

class WhatsAppWorkerTests(unittest.TestCase):
    def test_old_site_404_never_calls_ui(self):
        response=Mock(status_code=404)
        with patch.object(a.requests,'post',return_value=response),patch.object(a,'cloud_headers',return_value={}),patch.object(a,'api_url',return_value='https://test.invalid/dispatch'),patch.object(a.HELPER,'call') as helper:
            a.whatsapp_dispatch_once()
        helper.assert_not_called()
        response.raise_for_status.assert_not_called()
    def test_accepted_is_not_reported_as_delivered(self):
        response=Mock(status_code=200);response.json.return_value={'accepted':True}
        with patch.object(a.requests,'post',return_value=response),patch.object(a,'cloud_headers',return_value={}),patch.object(a,'api_url',return_value='https://test.invalid/dispatch'),patch.object(a,'log') as log:
            a.whatsapp_dispatch_once()
        self.assertIn('awaiting delivery webhook',log.call_args.args[0])
    def test_worker_network_failure_does_not_escape_or_run_ui(self):
        stop=Mock();stop.wait.side_effect=[False,True]
        with patch.object(a,'whatsapp_dispatch_once',side_effect=RuntimeError('offline')),patch.object(a,'log'),patch.object(a,'run_job') as run:
            a.whatsapp_worker(stop)
        run.assert_not_called()
