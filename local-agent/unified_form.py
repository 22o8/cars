"""Read the live Iraqi form metadata; never infer identifiers from arbitrary digits."""
from html.parser import HTMLParser
import re
from navigation import NavigationError, norm, subtree, visible

class Cells(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.row, self.cell = [], None, None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag == 'td': self.cell = []
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            if self.row is not None: self.row.append(''.join(self.cell).strip())
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None

def form_values(description):
    parser = Cells()
    parser.feed(description or '')
    fields = {'شركة': 'companyCode', 'اسم الشركة': 'companyName', 'تسجيل. رقم': 'registrationNo', 'باركود': 'procedureNo'}
    result = {}
    for row in parser.rows:
        if len(row) != 2: continue
        key = fields.get(row[0].rstrip(':').strip())
        value = row[1].strip()
        if not key or norm(value) in ('', 'n/a', 'null'): continue
        if key in result: raise NavigationError('ambiguous_form_metadata', 'Duplicate form identifiers')
        if key in ('companyCode', 'procedureNo', 'registrationNo') and not re.fullmatch(r'[0-9]+', value): continue
        result[key] = value
    return result

def company_editor(scope):
    combos = [n for n in scope if n.get('role') == 'combo box' and visible(n)
              and 'enabled' in n.get('states', []) and 'رمز الشركة' in n.get('description', '')]
    if len(combos) == 1:
        editors = [n for n in subtree(scope, combos[0]) if n.get('role') in ('text', 'editable text')
                   and visible(n) and 'enabled' in n.get('states', []) and 'editable' in n.get('states', [])]
        if len(editors) == 1: return editors[0]
    raise NavigationError('company_field_not_found', 'Company editor lacks a unique live company-code identity')


def unified_candidates(nodes):
    return [n for n in nodes if n.get('role')=='internal frame' and visible(n)
            and norm(n.get('name','')).startswith(norm('رقم الاجراء الموحد -'))
            and 'تسجيل. رقم:' in n.get('description','')]


def choose_unified_frame(nodes):
    frames=unified_candidates(nodes)
    if len(frames)==1: return frames[0]
    focused=[frame for frame in frames if any('focused' in n.get('states',[]) for n in subtree(nodes,frame))]
    if len(focused)==1: return focused[0]
    raise NavigationError('result_field_not_found',f'Unified frame identity ambiguous: candidates={len(frames)}, focused={len(focused)}; no action taken')


def verify_completion_receipt(receipt, number, hwnd, pid, dialog_closed, completion_dialog_visible):
    receipt=receipt or {}
    return bool(number and hwnd and receipt.get('procedureNo')==number
                and receipt.get('hwnd')==hwnd and receipt.get('pid')==pid
                and receipt.get('serverSuccess') is True and receipt.get('confirmationClicked') is True
                and dialog_closed and not completion_dialog_visible)
