import os
import sys

FILES_CORE = [
	'Sorollet.js',
	'utils/Math.js',
	'core/Voice.js',
	'core/ADSR.js',
	'player/Player.js',
	'player/Pattern.js'
]

FILES_GUI = [
	'libs/EventTarget.js',
	'libs/signals.min.js',
	'libs/UI.js',
	'libs/StringFormat.js',
	'gui/ADSRGUI.js',
	'gui/VoiceGUI.js',
	'gui/KeyboardGUI.js',
	'gui/KnobGUI.js',
	'gui/WaveTypeSelectGUI.js',
	'gui/MultipleStatePushButton.js',
	'gui/ScopeGraph.js'
]

ALL_FILES = FILES_CORE + FILES_GUI

def merge(files):
	buffer = []

	for filename in files:
		print(filename)
		with open(os.path.join('..', 'src', filename), 'r') as f:
			buffer.append(f.read())

	return "".join(buffer)


def output(text, filename):
	with open(os.path.join('..', 'build', filename), 'w') as f:
		f.write(text)


def add_header(text):
	return('// sorollet.js - http://github.com/sole/sorollet.js\n' + text)


def build(files, minified, filename):

	text = merge(files)

	output(add_header(text), filename)


# ---

def main(argv=None):

	build(ALL_FILES, False, 'Sorollet.js')
	build(FILES_CORE, False, 'Sorollet-core.js')

# ---

if __name__ == '__main__':
	main()


