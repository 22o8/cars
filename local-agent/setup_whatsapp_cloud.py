"""Collect Meta credentials locally; never print secrets or touch ASYCUDA credentials."""
from pathlib import Path
import json, re, secrets
import tkinter as tk
from tkinter import ttk, messagebox
import keyring

SERVICE='TarabilCustomsAgent'
BASE=Path(__file__).resolve().parent
FIELDS=[('WHATSAPP_PHONE_NUMBER_ID','Phone Number ID',''),('WHATSAPP_GRAPH_VERSION','Graph API version shown by Meta (vXX.0)',''),('WHATSAPP_ACCESS_TOKEN','System User Access Token',''),('WHATSAPP_APP_SECRET','Meta App Secret',''),('WHATSAPP_TEMPLATE_NAME','Approved template name','tarabil_procedure_completed'),('WHATSAPP_TEMPLATE_LANGUAGE','Template language code','ar')]

def main():
    root=tk.Tk();root.title('Tarabil - WhatsApp secure setup');root.geometry('690x510')
    ttk.Label(root,text='Enter Meta settings locally. Secrets will not be shown in chat or logs.',wraplength=650).pack(padx=16,pady=14)
    inputs={}
    for key,label,default in FIELDS:
        row=ttk.Frame(root);row.pack(fill='x',padx=16,pady=5)
        ttk.Label(row,text=label,width=39).pack(side='left')
        value=tk.StringVar(value=default)
        ttk.Entry(row,textvariable=value,show='*' if key in ('WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET') else '').pack(side='right',fill='x',expand=True)
        inputs[key]=value
    def save():
        values={k:v.get().strip() for k,v in inputs.items()}
        if not all(values.values()) or not re.fullmatch(r'\d+',values['WHATSAPP_PHONE_NUMBER_ID']) or not re.fullmatch(r'v\d+\.\d+',values['WHATSAPP_GRAPH_VERSION']):
            messagebox.showerror('Missing settings','Complete all fields. Phone Number ID must be numeric; API version must look like vXX.0.');return
        if not re.fullmatch('[a-z0-9_]+',values['WHATSAPP_TEMPLATE_NAME']):
            messagebox.showerror('Template','Use the exact approved template name.');return
        values['WHATSAPP_VERIFY_TOKEN']=keyring.get_password(SERVICE,'whatsapp_verify_token') or secrets.token_urlsafe(32)
        keyring.set_password(SERVICE,'whatsapp_verify_token',values['WHATSAPP_VERIFY_TOKEN'])
        for key in ('WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET'):
            keyring.set_password(SERVICE,key.lower(),values[key])
        folder=BASE/'diagnostics'/'whatsapp-setup';folder.mkdir(parents=True,exist_ok=True)
        target=folder/'.env.whatsapp.private'
        target.write_text('\n'.join(k+'='+json.dumps(v) for k,v in values.items())+'\n',encoding='utf-8')
        messagebox.showinfo('Saved locally','Saved private Vercel environment variables to:\n'+str(target)+'\n\nImport them into the existing Vercel project, then redeploy. Do not share this file or include it in a ZIP. This did not send any message.');root.destroy()
    ttk.Button(root,text='Save private settings for Vercel',command=save).pack(pady=18)
    ttk.Label(root,text='No messages or customs procedures will be created by this setup.\nUse the registered business number ID, not the Meta test number ID.',wraplength=650).pack(padx=16)
    root.mainloop()

if __name__=='__main__':main()
