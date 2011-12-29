/* JSMSX - MSX Emulator in Javascript
 * Copyright (c) 2006 Marcus Granado <mrc.gran(@)gmail.com>
 *
 * Portions of the initial code was inspired by the work of
 * Arnon Cardoso's Java MSX Emulator and
 * Adam Davidson & Andrew Pollard's Z80 class of the Spectrum Java Emulator
 * after reading this thread: http://www.msx.org/forumtopic4176.html
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */



/**
 * @constructor
 */
function JSMSX(window, canvas, logbuf) {
  var self = this;
  var i;
  var frameSkip = 0;
  //var sleepHack = 5;

  this.window = window;
  this.canvas = canvas;
  this.logbuf = logbuf;

  //this class builds on the Z80 class.
  this.superclass = Z80; //superclass
  this.superclass(3.58); //initialization
  //this.z80_interrupt = this.interrupt;

  this.vdp = null;
  this.psg = null;
  this.megarom = false;
  this.PPIPortA = 0;
  //this.PPIPortB = 255;
  this.PPIPortC = 0;
  this.PPIPortD = 0;
  this.pagMegaRom = [0, 1, 2, 3];
  //this.tamPagMegarom = 8192;
  this.tipoMegarom = 0;
  this.portos = Array(256);
  //this.controlPressionado = false;
  //this.shiftPressionado = false;
  this.estadoTeclas = [];
  this.memoria = []; //int[][]
  this.podeEscrever = [];
  this.pinta = true;
  this.cartSlot = 0;
  this.cart = []; //private int[][] cart;
  this.interruptCounter = 0;
  this.resetAtNextInterrupt = false;
  this.pauseAtNextInterrupt = false;
  //this.refreshNextInterrupt = true;
  //this.DipSwitchSYNC = true;

  this.handleEvent = function(e) {
    //alert("You pressed: which="+e.which+",keyUniCode="+e.keyCode+",shift="+e.shiftKey+",charCode="+e.charCode+",tochar="+String.fromCharCode(e.which)+",type="+e.type);
    return self.trataTecla.call(self, e.keyCode, e.type == 'keydown', e);
  };

  this.inb = function(i) {
    switch (i) {
      case 162:
        return this.psg.lePortaDados();
      case 168:
        return this.PPIPortA;
      case 169:
        return this.estadoTeclas[this.PPIPortC & 0xf];
      case 170:
        return this.PPIPortC;
      case 171:
        return this.PPIPortD;
      case 152:
        return this.vdp.lePortaDados();
      case 153:
        return this.vdp.lePortaComandos();
      default:
        if (this.portos[i] != -1)
          return this.portos[i];
        return 255;
    }
  };

  this.start = function() {
    var self = this;

    this.frameInterval = setInterval(function() {
      self.frame();
    }, 17); //60 intervals/sec
  };

  this.frame = function() {
    if (this.resetAtNextInterrupt) {
      this.resetAtNextInterrupt = false;
      this.reset();
    }

    this.execute();

    if (this.vdp.imagedata)
      this.vdp.imagedata.data[this.interruptCounter * 4 + 1] = 255;//green line

    document.getElementById('interrupts').value = this.interruptCounter;
    //if (this.interruptCounter%600==0)
    //this.ui.updateStatus('interrupt='+this.interruptCounter+',ticks='+this.tstatesPerInterrupt+' cpu ticks/interrupt');
    this.interruptCounter++;

    //this.DipSwitchSYNC = 1;
    if (this.pinta) {
      this.vdp.updateScreen();
      this.pinta = false;
    }
    if (this.interruptCounter % this.frameSkip == 0)
      this.vdp.montaUsandoMemoria();

    //return this.superclass.interrupt();
    //calls superclass' interrupt() in msx context/scope.
    //return this.z80_interrupt();
  };

  this.stop = function() {
    clearInterval(this.frameInterval);
  };

  this.loadbiosrom = function(url, slot, canvasbiosrom) {
    var biosrom = msx_loadurl(url);
    var ctxbiosrom;
    var imgdatabiosrom;
    var dbr;
    var biosromlength;
    var charcode;
    var i;

    this.ui.updateStatus('Reading bios rom ' + url);
    this.ui.updateStatus(biosrom.length + ' bytes read');

    if (biosrom != '') {
      canvasbiosrom.width = 256;
      canvasbiosrom.height = biosrom.length / 256;
      //alert(biosrom.length+','+canvasbiosrom.width+','+canvasbiosrom.height);
      ctxbiosrom = canvasbiosrom.getContext('2d');
      ctxbiosrom.fillStyle = 'rgb(0,0,0)';
      ctxbiosrom.fillRect(0, 0, canvasbiosrom.width, canvasbiosrom.height);
      if (ctxbiosrom.getImageData) {
        imgdatabiosrom = ctxbiosrom.getImageData(0, 0, canvasbiosrom.width, canvasbiosrom.height);
        dbr = imgdatabiosrom.data;
      }
      biosromlength = biosrom.length;
      // MimeType('application/octet-stream; charset=x-user-defined')
      for (i = 0; i < biosromlength; i++) {
        charcode = biosrom.charCodeAt(i) & 0xff;
        this.memoria[slot][i] = charcode;
        if (dbr) {
          dbr[i * 4] = charcode;
          dbr[i * 4 + 1] = charcode;
          dbr[i * 4 + 2] = charcode;
        } else {
          ctxbiosrom.fillStyle = 'rgb(' + charcode + ',' + charcode + ',' + charcode + ')';
          ctxbiosrom.fillRect(i % canvasbiosrom.width, Math.floor(i / canvasbiosrom.width), 1, 1);
        }
      }
      if (ctxbiosrom.putImageData) {
        ctxbiosrom.putImageData(imgdatabiosrom, 0, 0);
      }
    }
    return biosrom;
  };

  this.loadcartrom = function(url, cartslot, megaromtype, canvascartrom) {
    var cartrom = msx_loadurl(url);
    var ctxcartrom;
    var imgdatacartrom;
    var dbr;
    var cartromlength;
    var charcode;
    var i;
    var i_2_;

    this.ui.updateStatus('Reading cart rom ' + url);
    this.ui.updateStatus(cartrom.length + ' bytes read');

    if (cartrom != '') {
      canvascartrom.width = 256;
      canvascartrom.height = cartrom.length / 256;
      //alert(cartrom.length+','+canvascartrom.width+','+canvascartrom.height);
      ctxcartrom = canvascartrom.getContext('2d');
      ctxcartrom.fillStyle = 'rgb(0,0,0)';
      ctxcartrom.fillRect(0, 0, canvascartrom.width, canvascartrom.height);
      if (ctxcartrom.getImageData) {
        imgdatacartrom = ctxcartrom.getImageData(0, 0, canvascartrom.width, canvascartrom.height);
        dbr = imgdatacartrom.data;
      } else {
        dbr = Array(canvascartrom.width * canvascartrom.height * 4);
      }
      cartromlength = cartrom.length;
      // MimeType('application/octet-stream; charset=x-user-defined')
      for (i = 0; i < cartromlength; i++) {
        charcode = cartrom.charCodeAt(i) & 0xff;
        //this.memoria[slot][i]=charcode;
        dbr[i * 4] = charcode;
        dbr[i * 4 + 1] = charcode;
        dbr[i * 4 + 2] = charcode;
        if (!ctxcartrom.getImageData) {
          ctxcartrom.fillStyle = 'rgb(' + charcode + ',' + charcode + ',' + charcode + ')';
          ctxcartrom.fillRect(i % canvascartrom.width, Math.floor(i / canvascartrom.width), 1, 1);
        }
      }
      if (ctxcartrom.putImageData) {
        ctxcartrom.putImageData(imgdatacartrom, 0, 0);
      }
    }

    //bool = false;

    cartromlength = cartrom.length;

    for (i = 0; i < cartromlength; i++) {
      this.cart[Math.floor(i / 8192)][i % 8192] = dbr[i * 4] + 256 & 0xff;
    }
    if (cartromlength > 0)
      i_2_ = (dbr[3 * 4] < 0 ? dbr[3 * 4] + 256 : dbr[3 * 4]) * 256 + (dbr[2 * 4] < 0 ? dbr[2 * 4] + 256 : dbr[2 * 4]);
    if (i_2_ < 8192) {
      i_2_ = 0;
      this.PPIPortC = 250;
    } else if (i_2_ < 16384)
      i_2_ = 8192;
    else if (i_2_ < 32768)
      i_2_ = 16384;
    else
      i_2_ = 32768;
    this.ui.updateStatus('Cart start address:' + i_2_);
    if (cartromlength > 32768) {
      cartromlength = 16384;
      this.megarom = true;
      this.preparaMemoriaMegarom(megaromtype);
      this.ui.updateStatus('Megarom type ' + megaromtype);
    }
    for (i = 0; i < cartromlength; i++)
      this.memoria[cartslot][i + i_2_] = dbr[i * 4] + 256 & 0xff;

    return cartrom;
  };

  this.outb = function(i, i_19_, i_20_) {
    switch (i) {
      case 142:
        this.megarom = true;
        this.ui.updateStatus('Megarom mode');
        break;
      case 160:
        this.psg.escrevePortaEndereco(i_19_);
        break;
      case 161:
        this.psg.escrevePortaDados(i_19_);
        break;
      case 168:
        this.PPIPortA = i_19_;
        break;
      case 169:
        //this.PPIPortB = i_19_;
        break;
      case 170:
        this.PPIPortC = i_19_;
        break;
      case 171:
        this.PPIPortD = i_19_;
        break;
      case 152:
        this.vdp.escrevePortaDados(i_19_);
        break;
      case 153:
        this.vdp.escrevePortaComandos(i_19_);
        break;
      default:
        this.portos[i] = i_19_;
    }
  };

  this.peekb = function(i) {
    if (!this.megarom) {
      return this.memoria[0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13))][i];
    } else {
      if (((i & 0xc000) >> 14) == this.cartSlot && i <= 49151 && i >= 16384)
        return this.cart[this.pagMegaRom[(i >> 13) - 2]][i % 8192];
      else
        return this.memoria[0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13))][i];
    }
  };

  this.peekw = function(i) {
    if (!this.megarom) {
      return this.memoria[0x3 & (this.PPIPortA >> (((i + 1) & 0xc000) >> 13))][i + 1] << 8 |
          this.memoria[0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13))][i];
    } else {
      if (((i & 0xc000) >> 14) == this.cartSlot && i <= 49151 && i >= 16384)
        return this.cart[this.pagMegaRom[((i + 1) >> 13) - 2]][(i + 1) % 8192] << 8 |
            this.cart[this.pagMegaRom[(i >> 13) - 2]][i % 8192];
      else
        return this.memoria[0x3 & (this.PPIPortA >> (((i + 1) & 0xc000) >> 13))][i + 1] << 8 |
            this.memoria[0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13))][i];
    }
  };

  this.pokeb = function(i, i_25_) {
    var i_26_ = 0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13));

    if (this.podeEscrever[i_26_]) this.memoria[i_26_][i] = i_25_ & 0xff;
    if (i == 65535) this.memoria[i_26_][65535] = 255;
    if (!this.megarom) return;

    if (i_26_ == this.cartSlot) {
      switch (this.tipoMegarom) {
        case 0:
          if (i == 16384 || i == 20480)
            this.pagMegaRom[0] = i_25_ & 0xff;
          else if (i == 24576 || i == 28672)
            this.pagMegaRom[1] = i_25_ & 0xff;
          else if (i == 32768 || i == 36864)
            this.pagMegaRom[2] = i_25_ & 0xff;
          else if (i == 40960 || i == 45056)
            this.pagMegaRom[3] = i_25_ & 0xff;
          break;
        case 1:
          if (i == 16384 || i == 20480) {
            this.pagMegaRom[0] = i_25_ & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
          } else if (i == 32768 || i == 36864) {
            this.pagMegaRom[2] = i_25_ & 0xff;
            this.pagMegaRom[3] = this.pagMegaRom[2] + 1;
          }
          break;
        case 2:
          if (i >= 24576 && i <= 26623)
            this.pagMegaRom[0] = i_25_ & 0xff;
          else if (i >= 26624 && i <= 28671)
            this.pagMegaRom[1] = i_25_ & 0xff;
          else if (i >= 28672 && i <= 30719)
            this.pagMegaRom[2] = i_25_ & 0xff;
          else if (i >= 30720 && i <= 32767)
            this.pagMegaRom[3] = i_25_ & 0xff;
          break;
        case 3:
          if (i >= 24576 && i <= 26623) {
            this.pagMegaRom[0] = i_25_ & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
          } else if (i >= 28672 && i <= 30719) {
            this.pagMegaRom[2] = i_25_ & 0xff;
            this.pagMegaRom[3] = this.pagMegaRom[2] + 1;
          }
          break;
      }
    }
  };

  this.pokew = function(i, i_27_) {
    var i_28_ = 0x3 & (this.PPIPortA >> ((i & 0xc000) >> 13));

    if (this.podeEscrever[i_28_]) {
      this.memoria[i_28_][i] = i_27_ & 0xff;
      if (++i < 65535) this.memoria[i_28_][i] = i_27_ >> 8;
      if (i == 65535 || i == 65536) this.memoria[i_28_][65535] = 255;
    }
    if (!this.megarom) return;

    if (i_28_ == this.cartSlot) {
      switch (this.tipoMegarom) {
        case 0:
          if (i == 16384 || i == 20480)
            this.pagMegaRom[0] = i_27_ & 0xff;
          else if (i == 24576 || i == 28672)
            this.pagMegaRom[1] = i_27_ & 0xff;
          else if (i == 32768 || i == 36864)
            this.pagMegaRom[2] = i_27_ & 0xff;
          else if (i == 40960 || i == 45056)
            this.pagMegaRom[3] = i_27_ & 0xff;
          else if (i == 24575 || i == 28671)
            this.pagMegaRom[1] = i_27_ & 0xff;
          else if (i == 32767 || i == 36863)
            this.pagMegaRom[2] = i_27_ & 0xff;
          else if (i == 40959 || i == 45055)
            this.pagMegaRom[3] = i_27_ & 0xff;
          break;
        case 1:
          if (i == 16384 || i == 20480) {
            this.pagMegaRom[0] = i_27_ & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
          } else if (i == 32768 || i == 36864) {
            this.pagMegaRom[2] = i_27_ & 0xff;
            this.pagMegaRom[3] = this.pagMegaRom[2] + 1;
          } else if (i == 16383 || i == 20479) {
            this.pagMegaRom[0] = i_27_ >> 8 & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
          } else if (i == 24575 || i == 28671) {
            this.pagMegaRom[0] = i_27_ & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
            this.pagMegaRom[2] = i_27_ >> 8 & 0xff;
            this.pagMegaRom[3] = this.pagMegaRom[2] + 1;
          }
          break;
        case 2:
          if (i >= 24576 && i < 26623)
            this.pagMegaRom[0] = i_27_ & 0xff;
          else if (i >= 26624 && i < 28671)
            this.pagMegaRom[1] = i_27_ & 0xff;
          else if (i >= 28672 && i < 30719)
            this.pagMegaRom[2] = i_27_ & 0xff;
          else if (i >= 30720 && i < 32767)
            this.pagMegaRom[3] = i_27_ & 0xff;
          else if (i == 24575)
            this.pagMegaRom[0] = i_27_ >> 8 & 0xff;
          else if (i == 26623) {
            this.pagMegaRom[0] = i_27_ & 0xff;
            this.pagMegaRom[1] = i_27_ >> 8 & 0xff;
          } else if (i == 28671) {
            this.pagMegaRom[1] = i_27_ & 0xff;
            this.pagMegaRom[2] = i_27_ >> 8 & 0xff;
          } else if (i == 30719) {
            this.pagMegaRom[2] = i_27_ & 0xff;
            this.pagMegaRom[3] = i_27_ >> 8 & 0xff;
          } else if (i == 32767)
            this.pagMegaRom[3] = i_27_ & 0xff;
          break;
        case 3:
          if (i >= 24576 && i <= 26623) {
            this.pagMegaRom[0] = i_27_ & 0xff;
            this.pagMegaRom[1] = this.pagMegaRom[0] + 1;
          } else if (i >= 28672 && i <= 30719) {
            this.pagMegaRom[2] = i_27_ & 0xff;
            this.pagMegaRom[3] = this.pagMegaRom[2] + 1;
          }
          break;
      }
    }
  };

  this.preparaMemoriaMegarom = function(string) {
    if (string != null) {
      if (string == '0')
        this.tipoMegarom = 0;
      else if (string == '1')
        this.tipoMegarom = 1;
      else if (string == '2')
        this.tipoMegarom = 2;
      else if (string == '3')
        this.tipoMegarom = 3;
    }
  };

  this.trataTecla = function(i, bool, e) {
    switch (i) { //UNICODE VALUE
      case 48: //0
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xfe : this.estadoTeclas[0] | 0x1;
        break;
      case 49: //1
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xfd : this.estadoTeclas[0] | 0x2;
        break;
      case 50: //2
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xfb : this.estadoTeclas[0] | 0x4;
        break;
      case 51: //3
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xf7 : this.estadoTeclas[0] | 0x8;
        break;
      case 52: //4
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xef : this.estadoTeclas[0] | 0x10;
        break;
      case 53: //5
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xdf : this.estadoTeclas[0] | 0x20;
        break;
      case 54: //6
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0xbf : this.estadoTeclas[0] | 0x40;
        break;
      case 55: //7
        this.estadoTeclas[0]
        = bool ? this.estadoTeclas[0] & 0x7f : this.estadoTeclas[0] | 0x80;
        break;
      case 56: //8
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xfe : this.estadoTeclas[1] | 0x1;
        break;
      case 57: //9
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xfd : this.estadoTeclas[1] | 0x2;
        break;
      case 45: //-
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xfb : this.estadoTeclas[1] | 0x4;
        break;
      case 61: //^
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xf7 : this.estadoTeclas[1] | 0x8;
        break;
      case 92: //$
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xef : this.estadoTeclas[1] | 0x10;
        break;
      case 91: //@
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xdf : this.estadoTeclas[1] | 0x20;
        break;
      case 93: //(
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0xbf : this.estadoTeclas[1] | 0x40;
        break;
      case 59: //;
        this.estadoTeclas[1]
        = bool ? this.estadoTeclas[1] & 0x7f : this.estadoTeclas[1] | 0x80;
        break;
      //case 34:
      //case 39:
      case 1013: //:
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xfe : this.estadoTeclas[2] | 0x1;
        break;
      case 48: //)
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xfd : this.estadoTeclas[2] | 0x2;
        break;
      case 188: //,
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xfb : this.estadoTeclas[2] | 0x4;
        break;
      case 190: //.
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xf7 : this.estadoTeclas[2] | 0x8;
        break;
      case 191: ///
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xef : this.estadoTeclas[2] | 0x10;
        break;
      case 109: //_
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xdf : this.estadoTeclas[2] | 0x20;
        break;
      case 65: //A
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0xbf : this.estadoTeclas[2] | 0x40;
        break;
      case 66: //B
        this.estadoTeclas[2]
        = bool ? this.estadoTeclas[2] & 0x7f : this.estadoTeclas[2] | 0x80;
        break;
      case 67: //C
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xfe : this.estadoTeclas[3] | 0x1;
        break;
      case 68: //D
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xfd : this.estadoTeclas[3] | 0x2;
        break;
      case 69: //E
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xfb : this.estadoTeclas[3] | 0x4;
        break;
      case 70: //F
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xf7 : this.estadoTeclas[3] | 0x8;
        break;
      case 71: //G
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xef : this.estadoTeclas[3] | 0x10;
        break;
      case 72: //H
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xdf : this.estadoTeclas[3] | 0x20;
        break;
      case 73: //I
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0xbf : this.estadoTeclas[3] | 0x40;
        break;
      case 74: //J
        this.estadoTeclas[3]
        = bool ? this.estadoTeclas[3] & 0x7f : this.estadoTeclas[3] | 0x80;
        break;
      case 75: //K
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xfe : this.estadoTeclas[4] | 0x1;
        break;
      case 76: //L
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xfd : this.estadoTeclas[4] | 0x2;
        break;
      case 77: //M
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xfb : this.estadoTeclas[4] | 0x4;
        break;
      case 78: //N
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xf7 : this.estadoTeclas[4] | 0x8;
        break;
      case 79: //O
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xef : this.estadoTeclas[4] | 0x10;
        break;
      case 80: //P
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xdf : this.estadoTeclas[4] | 0x20;
        break;
      case 81: //Q
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0xbf : this.estadoTeclas[4] | 0x40;
        break;
      case 82: //R
        this.estadoTeclas[4]
        = bool ? this.estadoTeclas[4] & 0x7f : this.estadoTeclas[4] | 0x80;
        break;
      case 83: //S
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xfe : this.estadoTeclas[5] | 0x1;
        break;
      case 84: //T
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xfd : this.estadoTeclas[5] | 0x2;
        break;
      case 85: //U
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xfb : this.estadoTeclas[5] | 0x4;
        break;
      case 86: //V
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xf7 : this.estadoTeclas[5] | 0x8;
        break;
      case 87: //W
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xef : this.estadoTeclas[5] | 0x10;
        break;
      case 88: //X
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xdf : this.estadoTeclas[5] | 0x20;
        break;
      case 89: //Y
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0xbf : this.estadoTeclas[5] | 0x40;
        break;
      case 90: //Z
        this.estadoTeclas[5]
        = bool ? this.estadoTeclas[5] & 0x7f : this.estadoTeclas[5] | 0x80;
        break;
      case 1017:
        if (bool == true)
          this.pauseAtNextInterrupt = this.pauseAtNextInterrupt ^ true;
        break;
      case 1019:
        if (bool == true) {
          frameSkip++;
          frameSkip %= 20;
        }
        break;
      case 1018:
        if (bool == true) {
          frameSkip--;
          if (frameSkip < 1)
            frameSkip = 1;
        }
        break;
      case 16: //SHIFT
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xfe : this.estadoTeclas[6] | 0x1;
        break;
      case 17: //CTRL
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xfd : this.estadoTeclas[6] | 0x2;
        break;
      case 18: //GRAPH (ALT in PC)
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xfb : this.estadoTeclas[6] | 0x4;
        break;
      case 20: //CAP
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xf7 : this.estadoTeclas[6] | 0x8;
        break;
      case 118: //CODELOCK (F7 in PC)
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xef : this.estadoTeclas[6] | 0x10;
        break;
      case 112: //F1
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xdf : this.estadoTeclas[6] | 0x20;
        break;
      case 113: //F2
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0xbf : this.estadoTeclas[6] | 0x40;
        break;
      case 114: //F3
        this.estadoTeclas[6]
        = bool ? this.estadoTeclas[6] & 0x7f : this.estadoTeclas[6] | 0x80;
        break;
      case 115: //F4
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xfe : this.estadoTeclas[7] | 0x1;
        break;
      case 116: //F5
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xfd : this.estadoTeclas[7] | 0x2;
        break;
      case 27: //ESC
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xfb : this.estadoTeclas[7] | 0x4;
        break;
      case 9: //TAB
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xf7 : this.estadoTeclas[7] | 0x8;
        break;
      case 19: //STOP
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xef : this.estadoTeclas[7] | 0x10;
        break;
      case 8: //BACKSPACE
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xdf : this.estadoTeclas[7] | 0x20;
        break;
      case 117: //SELECT (F6 in PC)
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0xbf : this.estadoTeclas[7] | 0x40;
        break;
      case 13: //RETURN
        this.estadoTeclas[7]
        = bool ? this.estadoTeclas[7] & 0x7f : this.estadoTeclas[7] | 0x80;
        break;
      case 32: //SPACE
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xfe : this.estadoTeclas[8] | 0x1;
        break;
      case 36: //HOME
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xfd : this.estadoTeclas[8] | 0x2;
        break;
      case 45: //INSERT
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xfb : this.estadoTeclas[8] | 0x4;
        break;
      case 46: //DELETE
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xf7 : this.estadoTeclas[8] | 0x8;
        break;
      case 37: //LEFTARROW
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xef : this.estadoTeclas[8] | 0x10;
        break;
      case 38: //UPARROW
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xdf : this.estadoTeclas[8] | 0x20;
        break;
      case 40: //DOWNARROW
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0xbf : this.estadoTeclas[8] | 0x40;
        break;
      case 39: //RIGHTARROW
        this.estadoTeclas[8]
        = bool ? this.estadoTeclas[8] & 0x7f : this.estadoTeclas[8] | 0x80;
        break;

      default: //browser should handle key event
        return true;
    }

    e.returnValue = false;
    //e.cancelBubble = true;
    return false; //key event already handled
  };

  this.ui = new JSMSX.UI(logbuf);

  //local constructor
  //initializes local variables
  this.ui.updateStatus('Booting jsMSX');

  for (i = 0; i < 256; i++)
    this.portos[i] = -1;
  this.estadoTeclas = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];
  this.podeEscrever = [false, false, false, true];
  this.pinta = true;
  this.cart = Array(32); //2-dimensional array 32x8192 of cartridges
  for (i = 0; i < 32; i++) {
    //for (j=0; j<8192; j++) acart[j]=0;
    this.cart[i] = Array(8192);
  }
  this.interruptCounter = 0;
  this.frameSkip = 1;
  //this.sleepHack = 5;
  this.resetAtNextInterrupt = false;
  this.pauseAtNextInterrupt = false;
  //this.refreshNextInterrupt = true;
  //this.DipSwitchSYNC = 0;

  this.ui.updateStatus('Starting RAM slots');
  this.memoria = Array(4); //4 primary slots
  this.m0 = Array(65536);
  this.memoria[0] = this.m0;
  for (i = 0; i < 65536; i++) this.m0[i] = 255;
  this.m1 = Array(65536);
  this.memoria[1] = this.m1;
  for (i = 0; i < 65536; i++) this.m1[i] = 255;
  this.m2 = Array(65536);
  this.memoria[2] = this.m2;
  for (i = 0; i < 65536; i++) this.m2[i] = 255;
  this.m3 = Array(65536);
  this.memoria[3] = this.m3;
  for (i = 0; i < 65536; i++) this.m3[i] = 255;
  this.reset();

  this.ui.updateStatus('Starting VDP');
  this.vdp = new tms9918(this.canvas);

  this.ui.updateStatus('Starting PSG (No Sound)');
  this.psg = new psg8910();

  this.ui.updateStatus('interrupt=' + this.interruptCounter + ',ticks=' + Math.floor(this.tstatesPerInterrupt) + ' cpu ticks/interrupt, cpu clock=3.58 MHz');
  this.ui.updateStatus('jsMSX ready to go. Load ROMs and hit [start].');
}

var msx_loadurl = function(url) {
  //alert(url);
  var io = new browserio();
  var data = io.load(url);
  //alert(data);
  return data;
};
