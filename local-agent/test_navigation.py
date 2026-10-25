import ast
from pathlib import Path
import tempfile
import unittest
from navigation import plan, detect_state, NavigationError
from intelligent_planner import IntelligentPlanner
from screen_memory import ScreenMemory

def node(id, role, name='', parent=None, states=None, action=False, **extra):
 d=dict(id=str(id),role=role,name=name,parent=None if parent is None else str(parent),states=states or ['showing','enabled'],action=action)
 d.update(extra)
 return d
def snap(*nodes): return {'nodes':list(nodes),'truncated':False}

class PolicyTests(unittest.TestCase):
 def test_navigator_label_is_not_ready(self):
  self.assertNotEqual(detect_state(snap(node(1,'tree item','رقم الإجراء الموحد',action=True)))['state'],'UNIFIED_PROCEDURE_OPEN')
 def test_ready_requires_active_frame_and_company_field(self):
  s=snap(node(1,'internal frame','رقم الإجراء الموحد',states=['showing','selected']),node(2,'label','رمز الشركة',1),node(3,'text','',1))
  self.assertEqual(plan(s)['operation'],'ready')
  s['nodes'][0]['states']=['showing']
  self.assertNotEqual(plan(s)['operation'],'ready')
 def test_unknown_popup_overrides_ready(self):
  with self.assertRaises(NavigationError) as e:
   plan(snap(node(1,'alert','Delete?'),node(2,'push button','OK',1,action=True),node(3,'tree item','رقم الإجراء الموحد',action=True)))
  self.assertEqual(e.exception.code,'unknown_popup')
 def test_known_popup_uses_semantic_cancel(self):
  s=snap(node(1,'alert'),node(2,'label','لديك 13 رسالة غير مقروءة. هل تريد فتح صندوق البريد?',1),node(3,'push button','لا',1,action=True),node(4,'push button','لا',action=True))
  self.assertEqual(plan(s)['operation'],'dismiss_notifications')
 def test_unknown_no_is_not_clicked(self):
  with self.assertRaises(NavigationError): plan(snap(node(1,'alert','Confirm'),node(2,'push button','لا',1,action=True)))
 def test_save_requires_manual(self):
  with self.assertRaises(NavigationError) as e: plan(snap(node(1,'dialog','Save changes?'),node(2,'push button','Cancel',1)))
  self.assertEqual(e.exception.code,'manual_intervention_required')
 def test_declaration_is_not_closed(self):
  s=snap(node(1,'internal frame','تفاصيل البيان',states=['showing','selected']),node(2,'push button','Close',1,action=True),node(3,'tree item','رقم الإجراء الموحد',action=True))
  self.assertEqual(plan(s)['target'],'3')
 def test_duplicate_navigation_stops(self):
  with self.assertRaises(NavigationError): plan(snap(node(1,'tree item','رقم الإجراء الموحد',action=True),node(2,'tree item','رقم الإجراء الموحد',action=True)))
 def test_hidden_popup_ignored(self):
  self.assertEqual(plan(snap(node(1,'alert','unknown',states=['visible'])))['operation'],'wait')
 def test_truncated_tree_stops(self):
  with self.assertRaises(NavigationError): plan({'nodes':[],'truncated':True})
 def test_test_function_has_no_production_calls(self):
  tree=ast.parse(Path(__file__).with_name('agent.py').read_text(encoding='utf-8-sig'))
  function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run_navigation_test')
  calls={n.func.id for n in ast.walk(function) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name)}
  self.assertEqual(calls,{'check_cancelled','ensure_unified_procedure_screen','take_screenshot','NavigationError'})
 def _isolated_job_functions(self):
  tree=ast.parse(Path(__file__).with_name('agent.py').read_text(encoding='utf-8-sig'))
  wanted=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('create_unified_procedure','run_job')]
  module=ast.Module(body=wanted,type_ignores=[])
  ast.fix_missing_locations(module)
  ns={'NavigationError':NavigationError,'run_navigation_test':lambda:{'ok':True}}
  exec(compile(module,'agent.py','exec'),ns)
  return ns
 def test_unknown_job_never_infers_execute(self):
  ns=self._isolated_job_functions()
  with self.assertRaises(NavigationError) as e: ns['run_job']({'companyCode':'12345678'})
  self.assertEqual(e.exception.code,'invalid_job_kind')
 def test_production_disabled(self):
  ns=self._isolated_job_functions()
  with self.assertRaises(NavigationError): ns['run_job']({'kind':'execute','companyCode':'12345678'})

 def test_screen_memory_normalizes_dynamic_numbers(self):
  with tempfile.TemporaryDirectory() as td:
   m=ScreenMemory(Path(td))
   a=snap(node(1,'alert'),node(2,'label','لديك 13 رسالة غير مقروءة. هل تريد فتح صندوق البريد?',1))
   b=snap(node(1,'alert'),node(2,'label','لديك 99 رسالة غير مقروءة. هل تريد فتح صندوق البريد?',1))
   self.assertEqual(m.signature(a)['fingerprint'],m.signature(b)['fingerprint'])

 def test_taught_unnamed_popup_action_is_retrieved_safely(self):
  with tempfile.TemporaryDirectory() as td:
   planner=IntelligentPlanner(Path(td))
   s=snap(
    node(1,'alert'),
    node(2,'label','تنبيه تجريبي معروف للمستخدم',1),
    dict(node(3,'push button','',1,action=True),index_in_parent=0),
    dict(node(4,'push button','',1,action=True),index_in_parent=1),
   )
   planner.teach(s,'KNOWN_CUSTOM_POPUP','click',{'role':'push button','name':'','index_in_parent':1,'parent_text':'تنبيه تجريبي معروف للمستخدم'},'dismiss custom safe prompt')
   action=planner.decide(s)
   self.assertEqual(action['operation'],'click')
   self.assertEqual(action['target'],'4')
   self.assertEqual(action['source'],'memory')

 def test_taught_dangerous_button_is_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   planner=IntelligentPlanner(Path(td))
   s=snap(node(1,'alert','Unknown'),dict(node(2,'push button','Save',1,action=True),index_in_parent=0))
   planner.teach(s,'UNKNOWN_POPUP','click',{'role':'push button','name':'Save','index_in_parent':0,'parent_text':'Unknown'},'bad teaching')
   with self.assertRaises(NavigationError) as e:
    planner.decide(s)
   self.assertIn(e.exception.code,('manual_intervention_required','unsafe_action'))



class InteractiveReviewStateTests(unittest.TestCase):
    def test_predeclaration_is_detected_for_review(self):
        s=snap(node(1,'internal frame','البيان المسبق',states=['showing','selected']))
        self.assertEqual(detect_state(s)['state'],'PREDECLARATION_OPEN')

    def test_other_internal_page_is_not_mislabeled_main(self):
        s=snap(node(1,'internal frame','صفحة غير معروفة',states=['showing','selected']))
        self.assertEqual(detect_state(s)['state'],'OTHER_PAGE_OPEN')

    def test_notification_page_is_detected(self):
        s=snap(node(1,'internal frame','صندوق البريد',states=['showing','selected']))
        self.assertEqual(detect_state(s)['state'],'NOTIFICATIONS_PAGE')


class NotificationPopupTests(unittest.TestCase):
    def test_singular_unread_mail_popup_is_detected(self):
        s=snap(node(1,'alert'), node(2,'label','لديك رسالة واحدة غير مقروءة. هل تريد فتح صندوق البريد؟',1))
        self.assertEqual(detect_state(s)['state'], 'NOTIFICATIONS_POPUP')

    def test_unread_mail_text_detected_even_without_alert_role(self):
        s=snap(node(1,'panel','',states=['showing','enabled']), node(2,'label','لديك رسالة غير مقروءة. هل تريد فتح صندوق البريد؟',1))
        self.assertEqual(detect_state(s)['state'], 'NOTIFICATIONS_POPUP')

    def test_known_unread_mail_popup_uses_semantic_cancel(self):
        snapshot = {
            'truncated': False,
            'nodes': [
                {'id':'0','parent':None,'role':'alert','name':'','states':['showing','enabled'],'action':False},
                {'id':'1','parent':'0','role':'label','name':'لديك 13 رسالة غير مقروءة. هل تريد فتح صندوق البريد?','states':['showing','enabled'],'action':False},
                {'id':'2','parent':'0','role':'push button','name':'','states':['showing','enabled'],'action':True},
                {'id':'3','parent':'0','role':'push button','name':'','states':['showing','enabled'],'action':True},
            ]
        }
        action = plan(snapshot)
        self.assertEqual(action['operation'], 'dismiss_notifications')

class SmartLoginRegressionTests(unittest.TestCase):
    def test_helper_does_not_require_named_login_button(self):
        text = Path(__file__).with_name('jab_helper.py').read_text(encoding='utf-8-sig')
        self.assertIn("action['operation'] = 'login_filled'", text)
        self.assertNotIn("buttons[0]['id']", text)

    def test_agent_prefers_jab_login_button_and_verifies_login_exit(self):
        text = Path(__file__).with_name('agent.py').read_text(encoding='utf-8-sig')
        self.assertIn("HELPER.call('submit_login')", text)
        self.assertIn("pyautogui.press('enter')", text)
        self.assertIn("current.get('state') != 'LOGIN'", text)
        self.assertIn("'login_failed'", text)

    def test_helper_login_submit_is_login_scoped_and_fail_closed(self):
        text = Path(__file__).with_name('jab_helper.py').read_text(encoding='utf-8-sig')
        self.assertIn("request['command'] == 'submit_login'", text)
        self.assertIn("state_info.get('state') != 'LOGIN'", text)
        self.assertIn("len(buttons) != 2", text)
        self.assertIn("login_submit_ambiguous", text)

    def test_change_account_tool_uses_keyring_only(self):
        text = Path(__file__).with_name('change_asycuda_account.py').read_text(encoding='utf-8-sig')
        self.assertIn("keyring.set_password(SERVICE, 'asycuda_username'", text)
        self.assertIn("keyring.set_password(SERVICE, 'asycuda_password'", text)
        self.assertNotIn('config.json', text)


class ExactReviewTargetTests(unittest.TestCase):
    def test_popup_target_contains_window_identity(self):
        s=snap(
            node(1,'alert','',windowHwnd=222,windowMain=False,windowTitle='ASYCUDAWorld production server',bounds={'x':400,'y':300,'width':300,'height':140}),
            node(2,'label','لديك رسالة واحدة غير مقروءة. هل تريد فتح صندوق البريد؟',1,windowHwnd=222,windowMain=False,windowTitle='ASYCUDAWorld production server')
        )
        info=detect_state(s)
        self.assertEqual(info['state'],'NOTIFICATIONS_POPUP')
        self.assertEqual(info['target']['windowHwnd'],222)
        self.assertEqual(info['target']['kind'],'java_window')

    def test_internal_frame_target_has_live_bounds(self):
        s=snap(node(1,'internal frame','تفاصيل البيان',states=['showing','selected'],windowHwnd=100,windowMain=True,bounds={'x':200,'y':100,'width':700,'height':500}))
        info=detect_state(s)
        self.assertEqual(info['state'],'DECLARATION_OPEN')
        self.assertEqual(info['target']['kind'],'internal_frame')
        self.assertEqual(info['target']['bounds']['width'],700)

    def test_agent_uses_exact_review_target_and_verifies_close(self):
        text=Path(__file__).with_name('agent.py').read_text(encoding='utf-8-sig')
        self.assertIn("_close_exact_top_window", text)
        self.assertIn("_close_exact_internal_frame", text)
        self.assertIn("Reviewed screen did not close or changed before the action", text)
        self.assertNotIn("_dismiss_review_screen(state)\n", text)

    def test_helper_tags_nodes_with_window_hwnd(self):
        text=Path(__file__).with_name('jab_helper.py').read_text(encoding='utf-8-sig')
        self.assertIn("'windowHwnd': int(window_hwnd)", text)
        self.assertIn("'windowMain': bool(window_main)", text)


if __name__=='__main__': unittest.main()
