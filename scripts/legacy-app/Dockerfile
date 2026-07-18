FROM php:8.1-apache

# system libs for the PHP extensions the app needs
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpng-dev libjpeg-dev libfreetype6-dev libicu-dev libzip-dev libonig-dev \
      unzip git ca-certificates \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql gd intl bcmath exif zip mbstring calendar \
 && rm -rf /var/lib/apt/lists/*

# composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# apache: docroot -> httpdocs, allow .htaccess, mod_rewrite
RUN a2enmod rewrite headers
COPY vhost.conf /etc/apache2/sites-available/000-default.conf
COPY php.ini /usr/local/etc/php/conf.d/zz-fm.ini
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /var/log/fm && chmod 777 /var/log/fm

ENV FM_DEBUG=1
WORKDIR /var/www/html
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
