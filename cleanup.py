with open('c:/TenderZen/frontend/css/TeamlidModal.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all .modal.teamlid-modal with .teamlid-modal
content = content.replace('.modal.teamlid-modal', '.teamlid-modal')

with open('c:/TenderZen/frontend/css/TeamlidModal.css', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ All .modal.teamlid-modal replaced with .teamlid-modal')


