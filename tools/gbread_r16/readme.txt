GBRead FAQ
Author: Silenthal
Email: Silenthal.Makram at GMail

[Table Of Contents]
1. Intro
2. Requirements
3. Usage

[1. Intro]
This program (GBRead) is meant to assist in the disassembly of GB/GBC files.
Since the normal disassembly process does not differentiate between what is
code and what is data, there are extra options available to help break up
disassembled code into discrete parts, to further understanding of the code.

This program can also insert data back into the original file, whether through
ASM, or through an external binary.

[2. Requirements]
.Net Framework 4 or greater.

[3. Usage]

a. Load a File
-From the File menu, select 'Load File'. When loaded, the program will print
some info about the file in the main box.

b. Disassemble
-Type in the start and end offsets (in hex) into the 'Start' and 'End' boxes,
and hit 'Print ASM' Of course, code and data are mixed together 
throughout the file, so you know that some of the ASM displayed may be wrong.
In that case...

c. Mark Functions, Data, and Variables
-For sections that you think are used as functions or data, you can add a 
marker to set them off. To do so, click [Add New...], enter the offset, name,
and optional comment, and then [OK]. You can add data sections the same 
way, as well as specify commonly used variables. Data sections are just areas
like tables of pointers, dialogue, and other places you are sure aren't data. 
Data sections can be defined as uncompressed tiles (images) as well.
Variables can be defined, for when you suspect a certain location in the
memory map is used repeatedly (e.g. [$FF41], the LCD Status register).
Comments can also be added by themselves, through [Add Comments...].

c-2. Data Templates
Data templating (added in r16) is a way to format the output of a given data
section, when printed. Each command is ended with a semicolon (;).

    byte[count];
    word[count];
    dword[count];
    qword[count];
    string(length)[count];

byte,word,dword,qword,string: The type of data to print on a line. Sizes are
8-bit, 16-bit, 32-bit, 64-bit, and "variable", respectively.

count: The amount that is printed on a single line. For example:

    word[2];

    dw $4503, $3204

Omitting the array specifier is the same as having [1].

length: Used with the string option, specifies a fixed length string to be
printed.

    string(3)[2];

    ds "hah", "lol"

Omitting the length parameter, strings default to null-terminated, or best-fit
with the space available.

    string[1];

    ds "This is a sentence.\x00"

c-1-a: Tables
When printing strings, an ASCII table is used by default (well, just casting
each byte as a char). For other formats, you can use the option in the file
menu to load either regular table files, or Shift-JIS table files, for those
who still have them lying around. There is no support for string handling in
building (not at the moment, anyway).

d. View Labels/Variables
You can manage labels through clicking on them in the list to the right of the
main box. Double clicking on a regular label or data section label will
display the ASM following that label, while double clicking on a variable will
display where it's being used. More options for each label can be found by
right clicking on one.

e. Code/Data Insertion
You can insert ASM at a specified place, or a binary file. See 'about asm.txt'
for more details.

f. Saving
-In the File menu, you have several options for saving:

Save File: Saves a copy of the file you are working on. If you've altered the
file, you can save it this way.
Save Labels and Variables : Saves the contents of the function/data/var
boxes. Save format is as follows:

------------------------------------------------------------------------------
    gbr
    .label
    _n:<name>
    _o:<offset>
    _c:<comment line>

    .data
    _n:<name>
    _o:<offset>
    _c:<comment>
    _l:<length>
    _t:<type>
    _d:<data template>
    _p1:<palette color 1 (optional)>
    _p2:<palette color 2 (optional)>
    _p3:<palette color 3 (optional)>
    _p4:<palette color 4 (optional)>

    .var
    _n:<name>
    _v:<value>
    _c:<comment line>

gbr: The header of this save file format. Required.

label,data,var - Needed to specify between the two different types.
_n: Name. The symbol identifying the label/variable. Starts with a letter, and
consists of letter, numbers, and underscore.

_o: Offset. The offset of the label.

_c: Comment. You can include multiple lines in a comment. Prefix is optional.
Unlike the general comment, this one moves with the label.

_l: Length. The length of the data label. In printing, this is used to decide
how much to print. 

_t: Type. The type of data label. Can be either Data (for regular data), or
Image (for raw tiles).

_d: Data Template This determines how to format the data that is printed in
this section. For example:

    _d:b3

    db $56,$67,$07
    db $08,$08,$09
    db $09,$23,$54,
    db $23

    _d:b8

    db $56,$67,$07,$08,$08,$09,$09,$23
    db $54,$23

    _d:b8s3!4w2

    db $56,$67,$07,$08,$08,$09,$09,$23
    ds "haha","pony","lime"
    dw $2304, $2401

b, d, w, q, s: Represents byte, word, dword, qword, and string, in that order.
number: Specifies how many on the same line.
! : This, following the s#, specifies that the string is fixed length, with
the size following it.

_p1, 2, 3, 4: Palette colors. Each one is the 16-bit representation of the
color:
p[14:10] = Blue
p[9:5] = Green
p[4:0] = Red

Values are from 0-31 for each individual color, and the number itself can be
from 0 to 7FFF.
------------------------------------------------------------------------------

Save Entire File ASM: Will (try to) save the entire file in ASM form, with 
considerations made with respect to defined code/data sections, and variable
values.

g. Search

-Find Called Functions
Adds an entry in the code label table for every called offset, adjusted so that
it points to the right bank, if possible. Some functions may be missed through
this method, and there will be tens to hundreds of invalid ones as well, so 
try to use it as more of a jumping off point.

g. Options
-Word Wrap
Controls the behavior of the main text window when printing text to either
wrap around long lines or not.

-Print Bytes
Controls whether to print the bytes that correspond to the instruction being
shown. Useful if you are trying to figure out what an instruction actually is.

-Print Offsets
Controls whether offsets are printed along with the instruction. Shows exactly
where in the file the instruction is. Disable this and the 'Print Bytes' 
option to just show ASM, labels, and comments.

-Offset Number Format
-Instruction Number Format
Controls the format for numbers that are printed in the offsets (controlled by
'Print Offsets') and in the instructions themselves.
--BB:OOOO - A format used in some emulators. First two numbers are the bank,
            last 4 are the offset, as represented by the Program Counter.
--Hexadecimal - Hex (base 16)
--Numeral - Regular numbers (base 10)

-Print Extended ASM Comments
As comments beside each line, the instruction will be repeated, in a less
abbreviated format.
Ex: rlc b ;Rotate Left Carry B
...not so useful if you know what everything does, though.

-Hide Defined Data
Instead of printing out the entire data section, a placeholder will
be printed : INCLUDE "blah.bin". Can be used to make looking at certain
sections easier.
