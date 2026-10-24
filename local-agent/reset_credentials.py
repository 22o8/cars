import keyring
SERVICE='TarabilCustomsAgent'
for name in ('agent_device_token','asycuda_username','asycuda_password','whatsapp_access_token','whatsapp_phone_number_id'):
    try:
        keyring.delete_password(SERVICE,name)
    except Exception:
        pass
print('Local Tarabil credentials cleared.')
