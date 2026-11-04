import unittest
from unittest.mock import patch
import agent as a

class SinglePageTests(unittest.TestCase):
    def test_delayed_jab_open_is_not_dispatched_again(self):
        states=iter(['MAIN_SCREEN']*8+['UNIFIED_PROCEDURE_OPEN'])
        def call(command,**kw):
            if command=='step':return {'operation':'click','pageOpenRequested':True}
            if command=='snapshot':return {'state':next(states)}
            self.fail(command)
        with patch.object(a.HELPER,'call',side_effect=call) as helper,patch.object(a.time,'sleep'),patch.object(a,'_main_screen_live_click_fallback') as fallback:
            self.assertTrue(a._navigate_main_with_jab())
        self.assertEqual(sum(c.args[0]=='step' for c in helper.call_args_list),1)
        fallback.assert_not_called()
    def test_delayed_live_bounds_open_clicks_only_once(self):
        states=iter(['MAIN_SCREEN']*8+['UNIFIED_PROCEDURE_OPEN'])
        with patch.object(a,'_click_live_node',return_value=True) as click,patch.object(a.HELPER,'call',side_effect=lambda *args,**kw:{'state':next(states)}),patch.object(a.time,'sleep'):
            self.assertTrue(a._open_page_from_live_node({'id':'page'}))
        click.assert_called_once_with({'id':'page'},clicks=2,interval=.035)
    def test_timeout_does_not_fallback_or_reclick(self):
        with patch.object(a.HELPER,'call',return_value={'operation':'click','pageOpenRequested':True}),patch.object(a.time,'monotonic',side_effect=[0,21]),patch.object(a,'_main_screen_live_click_fallback') as fallback:
            with self.assertRaises(a.NavigationError) as error:a._navigate_main_with_jab()
        self.assertEqual(error.exception.code,'page_open_timeout')
        fallback.assert_not_called()
    def test_popup_exits_wait_for_outer_review_without_extra_actions(self):
        with patch.object(a.HELPER,'call',return_value={'state':'UNKNOWN_POPUP'}) as helper:
            self.assertTrue(a._wait_for_opened_page())
        helper.assert_called_once_with('snapshot')
    def test_cancel_stops_page_wait(self):
        with patch.object(a,'check_cancelled',side_effect=a.NavigationError('cancelled_by_user','stop')),patch.object(a.HELPER,'call') as helper:
            with self.assertRaises(a.NavigationError):a._wait_for_opened_page()
        helper.assert_not_called()
