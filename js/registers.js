/**
 * File: registers.js
 * Author: Jack YYF <root@jackyyf.com>
 */

(function(){
	var temp_registers = function(val){

		if(val === null || !(val instanceof Object)) {
			val = {};
		}

		// Fetch

		this.F_predPC = 0;
		this.F_carryPC = -1;
		this.F_stat = Constant.STAT_AOK;

		// Decode

		this.D_icode = Constant.I_NOP;
		this.D_ifun = 0;
		this.D_rA =Constant.R_NONE;
		this.D_rB = Constant.R_NONE;
		this.D_valC = 0;
		this.D_valP = 0;
		this.D_carryPC = -1;
		this.D_stat = Constant.STAT_BUB;

		// Execute

		this.E_icode = Constant.I_NOP;
		this.E_ifun = 0;
		this.E_valC = 0;
		this.E_valA = 0;
		this.E_valB = 0;
		this.E_dstE = Constant.R_NONE;
		this.E_dstM = Constant.R_NONE;
		this.E_srcA = Constant.R_NONE;
		this.E_srcB = Constant.R_NONE;
		this.E_carryPC = -1;
		this.E_stat = Constant.STAT_BUB;

		// Memory

		this.M_icode = Constant.I_NOP;
		this.M_valE = 0;
		this.M_valA = 0;
		this.M_dstE = Constant.R_NONE;
		this.M_dstM = Constant.R_NONE;
		this.M_stat = Constant.STAT_BUB;
		this.M_carryPC = -1;
		this.M_Cnd = false;

		// Write Back

		this.W_icode = Constant.I_NOP;
		this.W_valE = 0;
		this.W_valM =  0;
		this.W_dstE = Constant.R_NONE;
		this.W_dstM = Constant.R_NONE;
		this.W_stat = Constant.STAT_BUB;

		for (entry in val) {
			//console.log(entry);
			if(typeof this[entry] != 'undefined') {
				this[entry] = val[entry];
			}
		}

	};

	var registers = function(val) {
		if(val === null || !(val instanceof Object)) {
			val = {};
		}

		this.R_EAX = 0;
		this.R_ECX = 0;
		this.R_EDX = 0;
		this.R_EBX = 0;
		this.R_ESP = 0;
		this.R_EBP = 0;
		this.R_ESI = 0;
		this.R_EDI = 0;

		for (entry in val) {
			//console.log(entry);
			if(typeof this[entry] != 'undefined') {
				this[entry] = val[entry];
			}
		}

		var RegID = ['R_EAX', 'R_ECX', 'R_EDX', 'R_EBX', 'R_ESP', 'R_EBP', 'R_ESI', 'R_EDI'];

		this.get = function(id) {
			if(typeof id == 'undefined') {
				return 0;
			}
			if(id >= 0 && id < RegID.length) {
				return this[RegID[id]];
			}
			return 0;
		}

		this.set = function(id, val) {
			assert(isInt(id));
			if(id == Constant.R_NONE) return ;
			assert(id >= 0 && id < 8);
			this[RegID[id]] = val;
		}
	};

	window.Registers = registers;
	window.TempRegisters = temp_registers;
})();