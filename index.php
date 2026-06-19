<?php
// Root URL redirect fallback for Hostinger
// If .htaccess RewriteRule doesn't fire, PHP will handle it
header('Location: user/index.html', true, 302);
exit;
