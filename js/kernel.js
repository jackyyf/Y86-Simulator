/**
 * File: kernel.js
 * Author: Jack YYF <root@jackyyf.com>
 */

(function(){

	window.VM = {
		Memory  : new Memory(),
		Register : new Registers(),
		History : []
	};

	var ALU = function() {
		var inputA = 0, inputB = 0, fCode = 0, updateCC = false;
		var tVal = 0;
		var CC = 4; // ZF = 1, SF = 0, OF = 0

		var setZF = function(flag) {
		 	CC = ((!!flag) << 2) | (CC & 3);
		};

		var setSF = function(flag) {
			CC = ((!!flag) << 1) | (CC & 5);
		};

		var setOF = function(flag) {
			CC = (!!flag) | (CC & 6);
		};

		this.getZF = function() {
			return !!(CC & 4);
		};

		this.getSF = function() {
			return !!(CC & 2);
		};

		this.getOF = function() {
			return !!(CC & 1);
		};

		var getZF = this.getZF;
		var getSF = this.getSF;
		var getOF = this.getOF;

		this.setZF = setZF;
		this.setSF = setSF;
		this.setOF = setOF;

		this.getCC = function() { return CC; };

		var calculator = {};
		calculator[Constant.A_ADD] = function() {
			tVal = (inputB + inputA) | 0;
			updateCC && CCUpdater();
		};
		calculator[Constant.A_AND] = function() {
			tVal = inputB & inputA;
			updateCC && CCUpdater();
		};
		calculator[Constant.A_SUB] = function() {
			tVal = (inputB - inputA) | 0;
			updateCC && CCUpdater();
		};
		calculator[Constant.A_XOR] = function() {
			tVal = inputB ^ inputA;
			updateCC && CCUpdater();
		};

		var OFupdater = {};
		OFupdater[Constant.A_ADD] = function() {
			var a = toSigned(inputA), b = toSigned(inputB), val = toSigned(tVal);
			setOF(((a < 0) == (b < 0)) && ((val < 0) != (a < 0)));
		};
		OFupdater[Constant.A_AND] = function() {
			setOF(false);
		};
		OFupdater[Constant.A_SUB] = function() {
			var a = toSigned(inputA), b = toSigned(inputB), val = toSigned(tVal);
			setOF(((a > 0) == (b < 0)) && ((val < 0) != (b < 0)));
		};
		OFupdater[Constant.A_XOR] = function() {
			setOF(false);
		};

		var Condition = {};

		Condition[Constant.C_TRUE] = function() {
			return true;
		};

		Condition[Constant.C_LE] = function() {
			return (getSF() ^ getOF()) | getZF();
		};

		Condition[Constant.C_L] = function() {
			return getSF() ^ getOF();
		};

		Condition[Constant.C_E] = function() {
			return getZF();
		};

		Condition[Constant.C_NE] = function() {
			return !getZF();
		};

		Condition[Constant.C_GE] = function() {
			return !(getSF() ^ getOF());
		};

		Condition[Constant.C_G] = function() {
			return !((getSF() ^ getOF()) | getZF());
		};

		this.setInputA = function(valA) {
			assert(isInt(valA));
			inputA = valA;
		};

		this.setInputB = function(valB) {
			assert(isInt(valB));
			inputB = valB;
		};

		this.setFCode = function(code) {
			assert(isInt(code) && code >= 0 && code < 4);
			fCode = code;
		};

		this.setNeedCC = function(req) {
			updateCC = !!req;
		};

		this.run = function() { // Ret value is unsigned.
			calculator[fCode] && calculator[fCode]();
			return tVal;
		};

		this.getConditionCode = function(code) {
			try {
				assert(isInt(code) && code >= 0 && code < 7);
			} catch (e) {
				return true;
			}
			return Condition[code]();
		};

		var CCUpdater = function() {
			setSF(!!(tVal >>> 31));
			setZF(!tVal);
			OFupdater[fCode] && OFupdater[fCode]();
		};
	};

	window.CPU = function() {
		var input = new window.TempRegisters();
		var output = new window.TempRegisters();
		var hlt_flg = false;
		var stat = Constant.STAT_AOK;

		var cycle = 0, instruction = 0;

		this.stat = function() {
			return stat;
		};

		this.cycle = function() {
			return cycle;
		};

		//var alu = new ALU();
		window.alu = new ALU();

		var fetch = function() {

			if(hlt_flg) return;

			nextPC = input.F_predPC;
			if(input.M_icode == Constant.I_JXX && !input.M_Cnd) {
				nextPC = input.M_valA;
			} else if(input.W_icode == Constant.I_RET) {
				nextPC = input.W_valM;
			}

			var byte0 = VM.Memory.readByte(nextPC ++); // Read is always OK.
			output.D_icode = byte0 >> 4;
			output.D_ifun = byte0 & 15;

			// Check if instruction valid:

			if ([Constant.I_NOP, Constant.I_HALT, Constant.I_RRMOVL, Constant.I_IRMOVL,
				 Constant.I_RMMOVL, Constant.I_MRMOVL, Constant.I_OPL, Constant.I_JXX,
				 Constant.I_CALL, Constant.I_RET, Constant.I_PUSHL, Constant.I_POPL,
				 Constant.I_LEAVE, Constant.I_IADDL ].indexOf(output.D_icode) == -1) {
				output.F_stat = output.D_stat = Constant.STAT_INS;
				return ;
			}

			if (output.D_icode == Constant.I_HALT) {
				output.F_stat = output.D_stat = Constant.STAT_HLT;
				return ;
			}
			output.F_stat = output.D_stat = Constant.STAT_AOK;
			if ([Constant.I_RRMOVL, Constant.I_OPL, Constant.I_IRMOVL, Constant.I_MRMOVL,
				 Constant.I_RMMOVL, Constant.I_PUSHL, Constant.I_POPL, Constant.I_IADDL].indexOf(output.D_icode) != -1) {
				// Need Reg ID
				var regByte = VM.Memory.readByte(nextPC ++);
				output.D_rA = regByte >> 4; output.D_rB = regByte & 15;
			} else output.D_rA = output.D_rB = Constant.R_NONE;

			if ([Constant.I_IRMOVL, Constant.I_RMMOVL, Constant.I_MRMOVL,
				 Constant.I_JXX, Constant.I_CALL, Constant.I_IADDL].indexOf(output.D_icode) != -1) {
				// Need valC
				output.D_valC = VM.Memory.readInt(nextPC);
				nextPC += 4;
			}

			output.F_predPC = nextPC;
			if([Constant.I_JXX, Constant.I_CALL].indexOf(output.D_icode) != -1) {
				output.F_predPC = output.D_valC;
			}
			output.D_valP = nextPC;
		};

		var decode = function() {

			// Simply passing regs.

			output.E_icode = input.D_icode;
			output.E_ifun = input.D_ifun;
			output.E_valC = input.D_valC;
			output.E_stat = input.D_stat;

			// output.E_srcA

			if([Constant.I_RRMOVL, Constant.I_RMMOVL, Constant.I_OPL, Constant.I_PUSHL].indexOf(input.D_icode) != -1)
				output.E_srcA = input.D_rA;
			else if ([Constant.I_POPL, Constant.I_RET].indexOf(input.D_icode) != -1)
				output.E_srcA = Constant.R_ESP;
			else if (input.D_icode == Constant.I_LEAVE)
				output.E_srcA = Constant.R_EBP;
			else output.E_srcA = Constant.R_NONE;

			// output.E_srcB

			if([Constant.I_OPL, Constant.I_RMMOVL, Constant.I_MRMOVL, Constant.I_IADDL].indexOf(input.D_icode) != -1)
				output.E_srcB = input.D_rB;
			else if ([Constant.I_PUSHL, Constant.I_POPL, Constant.I_CALL, Constant.I_RET].indexOf(input.D_icode) != -1)
				output.E_srcB = Constant.R_ESP;
			else if (input.D_icode == Constant.I_LEAVE)
				output.E_srcB = Constant.R_EBP;
			else output.E_srcB = Constant.R_NONE;

			// output.E_dstE

			if([Constant.I_RRMOVL, Constant.I_IRMOVL, Constant.I_OPL, Constant.I_IADDL].indexOf(input.D_icode) != -1)
				output.E_dstE = input.D_rB;
			else if([Constant.I_PUSHL, Constant.I_POPL, Constant.I_CALL, Constant.I_RET, Constant.I_LEAVE].indexOf(input.D_icode) != -1)
				output.E_dstE = Constant.R_ESP;
			else output.E_dstE = Constant.R_NONE;

			// output.E_dstM

			if([Constant.I_MRMOVL, Constant.I_POPL].indexOf(input.D_icode) != -1)
				output.E_dstM = input.D_rA;
			else if (input.D_icode == Constant.I_LEAVE)
				output.E_dstM = Constant.R_EBP;
			else output.E_dstM = Constant.R_NONE;

			// output.E_valA

			if([Constant.I_CALL, Constant.I_JXX].indexOf(input.D_icode) != -1)
				output.E_valA = input.D_valP;
			else if(output.E_srcA == output.M_dstE)
				output.E_valA = output.M_valE;
			else if(output.E_srcA == input.M_dstM)
				output.E_valA = output.W_valM;
			else if(output.E_srcA == input.M_dstE)
				output.E_valA = input.M_valE;
			else if(output.E_srcA == input.W_dstM)
				output.E_valA = input.W_valM;
			else if(output.E_srcA == input.W_dstE)
				output.E_valA = input.W_valE;
			else output.E_valA = VM.Register.get(output.E_srcA);

			// output.E_valB

			if(output.E_srcB == output.M_dstE)
				output.E_valB = output.M_valE;
			else if(output.E_srcB == input.M_dstM)
				output.E_valB = output.W_valM;
			else if(output.E_srcB == input.M_dstE)
				output.E_valB = input.M_valE;
			else if(output.E_srcB == input.W_dstM)
				output.E_valB = input.W_valM;
			else if(output.E_srcB == input.W_dstE)
				output.E_valB = input.W_valE;
			else output.E_valB = VM.Register.get(output.E_srcB);

		};

		var execute = function() {

			// Simply passing regs.

			output.M_icode = input.E_icode;
			output.M_valA = input.E_valA;
			output.M_dstM = input.E_dstM;
			output.M_stat = input.E_stat;

			// alu.inputA

			if(input.E_icode == Constant.I_HALT && input.E_stat != Constant.STAT_BUB) {
				hlt_flg = true;
				output.M_stat = Constant.STAT_HLT;
			}
			if([Constant.I_RRMOVL, Constant.I_OPL].indexOf(input.E_icode) != -1)
				alu.setInputA(input.E_valA);
			else if([Constant.I_IRMOVL, Constant.I_RMMOVL, Constant.I_MRMOVL, Constant.I_IADDL].indexOf(input.E_icode) != -1)
				alu.setInputA(input.E_valC);
			else if([Constant.I_CALL, Constant.I_PUSHL].indexOf(input.E_icode) != -1)
				alu.setInputA(-4);
			else if([Constant.I_RET, Constant.I_POPL, Constant.I_LEAVE].indexOf(input.E_icode) != -1)
				alu.setInputA(4);
			else alu.setInputA(0);

			// alu.inputB

			if([Constant.I_RMMOVL, Constant.I_MRMOVL, Constant.I_OPL, Constant.I_CALL,
			    Constant.I_PUSHL, Constant.I_RET, Constant.I_POPL, Constant.I_IADDL, Constant.I_LEAVE].indexOf(input.E_icode) != -1)
				alu.setInputB(input.E_valB);
			else alu.setInputB(0);

			// alu.fCode

			if(input.E_icode == Constant.I_OPL)
				alu.setFCode(input.E_ifun);
			else alu.setFCode(0);

			// alu.setCC

			if([Constant.I_OPL, Constant.I_IADDL].indexOf(input.E_icode) != -1
				&& [Constant.STAT_ADR, Constant.STAT_INS, Constant.STAT_HLT].indexOf(output.W_stat) == -1
				&& [Constant.STAT_ADR, Constant.STAT_INS, Constant.STAT_HLT].indexOf(input.W_stat) == -1)
				alu.setNeedCC(true);
			else alu.setNeedCC(false);

			output.M_valE = alu.run();
			output.M_Cnd = alu.getConditionCode(input.E_ifun);
			output.M_valA = input.E_valA;
			if(input.E_icode == Constant.I_RRMOVL && !output.M_Cnd)
				output.M_dstE = Constant.R_NONE;
			else output.M_dstE = input.E_dstE;



		};

		var memory = function() {
			var rMem = false, wMem = false, mAddr = toSigned(0);

			//if(input.M_stat == Constant.STAT_BUB) return;

			// Simply passing regs.

			output.W_stat = input.M_stat;
			output.W_icode = input.M_icode;
			output.W_valE = input.M_valE;
			output.W_dstE = input.M_dstE;
			output.W_dstM = input.M_dstM;

			// mAddr

			if([Constant.I_RMMOVL, Constant.I_PUSHL, Constant.I_CALL, Constant.I_MRMOVL].indexOf(input.M_icode) != -1)
				mAddr = input.M_valE;
			else if([Constant.I_POPL, Constant.I_RET, Constant.I_LEAVE].indexOf(input.M_icode) != -1)
				mAddr = input.M_valA;

			// rMem

			rMem = [Constant.I_MRMOVL, Constant.I_POPL, Constant.I_RET, Constant.I_LEAVE].indexOf(input.M_icode) != -1;

			// wMem

			wMem = [Constant.I_RMMOVL, Constant.I_PUSHL, Constant.I_CALL].indexOf(input.M_icode) != -1;

			// output.W_valM

			if(rMem) output.W_valM = VM.Memory.readInt(mAddr);
			if(wMem)
				try {
					VM.Memory.writeInt(mAddr, input.M_valA);
				} catch(e) {
					// MEMORY ERROR!
					output.W_stat = Constant.STAT_ADR;
				};
		};

		var write_back = function() {
			stat = input.W_stat;
			if (input.W_icode == Constant.I_RMMOVL) return;
			VM.Register.set(input.W_dstE, input.W_valE);
			VM.Register.set(input.W_dstM, input.W_valM);
		};

		var writeRegs = function() {

			// First set state.

			var F_stall = (([Constant.I_MRMOVL, Constant.I_POPL, Constant.I_LEAVE].indexOf(input.E_icode) != -1)
						  && ([output.E_srcA, output.E_srcB].indexOf(input.E_dstM) != -1))
						  || ([input.D_icode, input.E_icode, input.M_icode].indexOf(Constant.I_RET) != -1);

			var D_stall = ([Constant.I_MRMOVL, Constant.I_POPL, Constant.I_LEAVE].indexOf(input.E_icode) != -1)
						  && ([output.E_srcA, output.E_srcB].indexOf(input.E_dstM) != -1);

			var D_bubble = (input.E_icode == Constant.I_JXX && !output.M_Cnd)
						  || ((!D_stall) && ([input.D_icode, input.E_icode, input.M_icode].indexOf(Constant.I_RET) != -1));

			var E_bubble = (input.E_icode == Constant.I_JXX && !output.M_Cnd)
						  || (([Constant.I_MRMOVL, Constant.I_POPL, Constant.I_LEAVE].indexOf(input.E_icode) != -1 && [output.E_srcA, output.E_srcB].indexOf(input.E_dstM) != -1));

			var M_bubble = [Constant.STAT_ADR, Constant.STAT_INS, Constant.STAT_HLT].indexOf(output.W_stat) != -1
						   || [Constant.STAT_ADR, Constant.STAT_INS, Constant.STAT_HLT].indexOf(input.W_stat) != -1;

//			var W_stall = [Constant.STAT_ADR, Constant.STAT_INS, Constant.STAT_HLT].indexOf(input.W_stat) != -1;

			// Then write Regs from input to output.

			var tmpIn = new TempRegisters(output); // Generate a copy of output.

/*			if(W_stall) {
				tmpIn.W_dstE = input.W_dstE;
				tmpIn.W_dstM = input.W_dstM;
				tmpIn.W_icode = input.W_icode;
				tmpIn.W_stat = input.W_stat;
				tmpIn.W_valE = input.W_valE;
				tmpIn.W_valM = input.W_valM;
			} */


			if(M_bubble) { // Memory bubble?
				tmpIn.M_icode = Constant.I_NOP;
				tmpIn.M_stat = Constant.STAT_BUB;
				tmpIn.M_dstE = tmpIn.M_dstM = Constant.R_NONE;
				tmpIn.M_Cnd = false;
			}

			if(E_bubble) { // Execute bubble?
				tmpIn.E_icode = Constant.I_NOP; tmpIn.E_ifun = 0;
				tmpIn.E_stat = Constant.STAT_BUB;
				tmpIn.E_dstE = tmpIn.E_dstM = tmpIn.E_srcA = tmpIn.E_srcB = Constant.R_NONE;
			}

			if(D_stall) { // Decode stall? Copy back :(
				tmpIn.D_icode = input.D_icode;
				tmpIn.D_ifun = input.D_ifun;
				tmpIn.D_rA = input.D_rA;
				tmpIn.D_rB = input.D_rB;
				tmpIn.D_valC = input.D_valC;
				tmpIn.D_valP = input.D_valP;
			}

			if(D_bubble) { // Decode bubble?
				tmpIn.D_icode = Constant.I_NOP; tmpIn.D_ifun = 0;
				tmpIn.D_stat = Constant.STAT_BUB;
			}

			if(F_stall) { // Fetch stall? Recover pred_PC
				tmpIn.F_predPC = input.F_predPC;
			}

			input = tmpIn;

		};

		this.notify = function() { // Generate a clock tick.
			if (input.W_icode == Constant.I_HALT) stat = Constant.STAT_HLT;
			if (stat != Constant.STAT_AOK && stat != Constant.STAT_BUB) throw stat;
			// Temp Regs now write value into the target.

			write_back();
			memory();
			execute();
			decode();
			fetch();
			++ cycle;
			if(stat != Constant.STAT_BUB) ++ instruction;

			writeRegs();
			// Get a copy in order to roll back.
			// VM.History.push(input);
			// updateDisplay(input);
		};

		this.getInput = function() {
			return input;
		}

		this.instruction = function() {
			return instruction;
		}

	};

})();
