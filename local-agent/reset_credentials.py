import keyring
SERVICE='TarabilCustomsAgent'
for name in ('agent_device_token','asycuda_username','asycuda_password'):
    try:
        keyring.delete_password(SERVICE,name)
    except Exception:
        pass
print('Local Tarabil credentials cleared.')
