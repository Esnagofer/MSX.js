# MSX.js

This is a MSX emulator 100% written in JavaScript.

It's based on the [jsMSX](http://jsmsx.sourceforge.net/) project and 
forked from the [gmarty / jsMSX](https://github.com/gmarty/jsMSX) GitHub repository.


## Lib and Roms directories

Create two directories called _lib_ and _roms_ to put jquery lib and ROM files there.

Example:

```
lib
  jquery.min.js
  
roms
  bios
    cbios_main_msx1.rom
    expert_1.0_basic-bios1.rom
  games
    KNMARE.ROM
    ROAD.ROM
```

## Configuring Apache

Since we are having some difficulties to load the ROMs from local files,
we configured Apache to serve the app and the ROM files.

```
$ sudo vi /etc/apache2/sites-available/msxjs

-----------------------------------------------
Alias /jsmsx /home/nodeminderjs/workspace/msxjs

<Directory /home/nodeminderjs/workspace/msxjs/>
  Options Indexes FollowSymLinks MultiViews
  AllowOverride None
  Order allow,deny
  allow from all
</Directory>
-----------------------------------------------

$ sudo ln -s /etc/apache2/sites-available/msxjs /etc/apache2/sites-enabled/msxjs
$ sudo service apache2 restart
```

## Credits

Original repo is on [SourceForge](http://sourceforge.net/projects/jsmsx/).

Original author is [Marcus Granado](mrc.gran @ gmail.com).

### README from the original author

jsMSX is a MSX emulator 100% written in JavaScript. Yes, you read it: JavaScript! It emulates the underlying Z80 CPU, TMS9918 Video Display Processor (VDP), PPI, RAM slots and Megaram. In its present form, it should be able to run any program or game developed for MSX 1.0.

If you think you'd like to participate, are just curious or want to say hello, please have a look at the project.

Portions of the initial JavaScript code was derived from Arnon Cardoso's Java MSX Emulator (first Java MSX emulator), Murilo Queiroz's Java Phoenix Emulator (first Java Arcade emulator) and Davidson&Pollard's Z80 class of the
 Spectrum Java Emulator, after reading this thread: http://www.msx.org/forumtopic4176.html. Thank you all for your past efforts!


## License

JSMSX - MSX Emulator in JavaScript
Copyright (c) 2006 Marcus Granado <mrc.gran(@)gmail.com>

Portions of the initial code was inspired by the work of
Arnon Cardoso's Java MSX Emulator and
Adam Davidson & Andrew Pollard's Z80 class of the Spectrum Java Emulator
after reading this thread: http://www.msx.org/forumtopic4176.html

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
version 2 as published by the Free Software Foundation.
The full license is available at http://www.gnu.org/licenses/gpl.html

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
