import unittest
from unified_form import form_values, company_editor
from navigation import NavigationError

class ActualFormTests(unittest.TestCase):
    def test_reads_only_registration_number(self):
        html='<table><tr><td>شركة:</td><td>31000063</td></tr><tr><td>تسجيل. رقم:</td><td>98765</td></tr><tr><td>باركود:</td><td>2600098765</td></tr><tr><td>اسم الشركة:</td><td>Company &amp; Co.</td></tr></table>'
        self.assertEqual(form_values(html), {'companyCode':'31000063','registrationNo':'98765','procedureNo':'2600098765','companyName':'Company & Co.'})
    def test_unregistered_is_not_number(self):
        self.assertNotIn('procedureNo', form_values('<tr><td>تسجيل. رقم:</td><td>n/a</td></tr>'))
    def test_date_or_arbitrary_digits_not_accepted(self):
        self.assertEqual(form_values('<tr><td>تاريخ:</td><td>2026</td></tr><tr><td>تسجيل. رقم:</td><td>Error 123</td></tr>'),{})
    def test_duplicate_identifiers_fail_closed(self):
        with self.assertRaises(NavigationError): form_values('<tr><td>شركة:</td><td>1</td></tr>'*2)
    def test_exact_company_editor_in_combo(self):
        combo={'id':'1','role':'combo box','description':'<td>رمز الشركة</td>','states':['showing','enabled']}
        field={'id':'2','parent':'1','role':'text','states':['showing','enabled','editable']}
        self.assertEqual(company_editor([combo,field]),field)
    def test_unlabelled_field_cannot_be_company(self):
        with self.assertRaises(NavigationError): company_editor([{'id':'1','role':'text','states':['showing','enabled','editable']}])

class DuplicateFrameTests(unittest.TestCase):
    def frames(self):
        return [{'id':str(i),'role':'internal frame','name':'رقم الاجراء الموحد - جديد [n/a]','description':'<tr><td>تسجيل. رقم:</td><td>n/a</td></tr>','states':['showing']} for i in (1,2)]
    def test_only_focused_form_is_selected(self):
        from unified_form import choose_unified_frame
        nodes=self.frames()+[{'id':'3','parent':'2','role':'text','states':['showing','focused']}]
        self.assertEqual(choose_unified_frame(nodes)['id'],'2')
    def test_identical_unfocused_forms_are_ambiguous(self):
        from unified_form import choose_unified_frame
        with self.assertRaises(NavigationError): choose_unified_frame(self.frames())
    def test_two_focused_forms_are_ambiguous(self):
        from unified_form import choose_unified_frame
        nodes=self.frames()+[{'id':'3','parent':'1','states':['focused']},{'id':'4','parent':'2','states':['focused']}]
        with self.assertRaises(NavigationError): choose_unified_frame(nodes)

class BoundFrameTests(unittest.TestCase):
    def test_java_identity_survives_node_reindexing(self):
        from jab_helper import Session
        from unittest.mock import Mock
        session=Session.__new__(Session)
        original=Mock(vmid=7,accessible_context=100)
        original._is_same_object.side_effect=lambda a,b: b==200
        session.bound_frame=original
        session.elements={'8':Mock(vmid=7,accessible_context=300),'9':Mock(vmid=7,accessible_context=200)}
        nodes=DuplicateFrameTests().frames()
        nodes[0]['id']='8';nodes[1]['id']='9'
        self.assertEqual(session.unified_frame({'nodes':nodes})['id'],'9')
    def test_disappeared_bound_form_never_switches_to_another(self):
        from jab_helper import Session
        from unittest.mock import Mock
        session=Session.__new__(Session)
        session.bound_frame=Mock(vmid=7,accessible_context=100)
        session.bound_frame._is_same_object.return_value=False
        session.elements={'1':Mock(vmid=7,accessible_context=300),'2':Mock(vmid=7,accessible_context=400)}
        with self.assertRaises(NavigationError): session.unified_frame({'nodes':DuplicateFrameTests().frames()})
    def test_new_job_explicitly_releases_old_binding(self):
        from jab_helper import Session
        from unittest.mock import Mock
        session=Session.__new__(Session);old=Mock();session.bound_frame=old
        session.request({'command':'reset_procedure_binding'})
        self.assertIsNone(session.bound_frame)
        old.release_jabelement.assert_called_once()

if __name__=='__main__': unittest.main()
