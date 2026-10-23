import ast
from pathlib import Path
import unittest
from navigation import plan, detect_state, NavigationError

def node(id, role, name='', parent=None, states=None, action=False):
 return dict(id=str(id),role=role,name=name,parent=None if parent is None else str(parent),states=states or ['showing','enabled'],action=action)
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
 def test_known_popup_scopes_no_to_popup(self):
  s=snap(node(1,'alert'),node(2,'label','لديك 13 رسالة غير مقروءة. هل تريد فتح صندوق البريد?',1),node(3,'push button','لا',1,action=True),node(4,'push button','لا',action=True))
  self.assertEqual(plan(s)['target'],'3')
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
  self.assertEqual(calls,{'ensure_unified_procedure_screen','take_screenshot','NavigationError'})
 def test_unknown_job_never_infers_execute(self):
  import agent
  with self.assertRaises(NavigationError) as e: agent.run_job({'companyCode':'12345678'})
  self.assertEqual(e.exception.code,'invalid_job_kind')
 def test_production_disabled(self):
  import agent
  with self.assertRaises(NavigationError): agent.run_job({'kind':'execute','companyCode':'12345678'})

if __name__=='__main__': unittest.main()
